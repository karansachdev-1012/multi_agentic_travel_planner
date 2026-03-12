"""FastAPI verification microservice — TripMind v2."""
import logging
import time

import asyncio
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from cache import init_db, get_cache_stats, clear_cache
from models import VerifyRequest, VerifyResponse
from orchestrator import run_verification, run_verification_streaming

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("tripmind")

app = FastAPI(title="TripMind Verification Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    logger.info("TripMind Verification Service started on :8000")


@app.get("/health")
async def health():
    cache_stats = await get_cache_stats()
    return {
        "status": "ok",
        "service": "tripmind-verification",
        "cache": cache_stats,
    }


@app.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest):
    """Run all verification agents concurrently on a trip plan."""
    start = time.time()
    logger.info(
        f"Verification request: {len(req.destinations)} destinations, "
        f"{req.check_in} to {req.check_out}, {req.adults} adults"
    )
    result = await run_verification(req)
    elapsed = round((time.time() - start) * 1000)
    logger.info(
        f"Verification complete in {elapsed}ms — "
        f"score: {result.verification_score:.0f}%"
    )
    return result


@app.post("/verify/stream")
async def verify_stream(req: VerifyRequest):
    """Run verification with SSE streaming — each agent result is sent as it completes."""
    start = time.time()
    logger.info(
        f"Streaming verification: {len(req.destinations)} destinations, "
        f"{req.check_in} to {req.check_out}, {req.adults} adults"
    )

    # Queue to push SSE events from the callback
    queue = asyncio.Queue()

    async def on_result(name, status, response):
        """Called each time an agent completes."""
        event = {
            "agent": name,
            "status": status.model_dump(),
            "snapshot": response.model_dump(),
        }
        await queue.put(event)

    async def run_and_signal():
        result = await run_verification_streaming(req, on_result)
        elapsed = round((time.time() - start) * 1000)
        logger.info(
            f"Streaming verification complete in {elapsed}ms — "
            f"score: {result.verification_score:.0f}%"
        )
        # Signal completion
        await queue.put(None)

    async def event_generator():
        task = asyncio.create_task(run_and_signal())
        while True:
            event = await queue.get()
            if event is None:
                # Send final done event
                yield f"data: [DONE]\n\n"
                break
            yield f"data: {json.dumps(event)}\n\n"
        await task  # Ensure task completes

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/hotels/search")
async def search_hotels(
    city: str = "",
    check_in: str = "",
    check_out: str = "",
    adults: int = 2,
    children: int = 0,
    max_price: float = 0,
    currency: str = "USD",
):
    """On-demand hotel search for swap feature."""
    from agents.hotel_agent import run_hotel_agent
    results = await run_hotel_agent(city, check_in, check_out, adults, children, max_price, currency)
    return [r.model_dump() for r in results]


@app.post("/clear-cache")
async def clear():
    await clear_cache()
    return {"status": "cleared"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
