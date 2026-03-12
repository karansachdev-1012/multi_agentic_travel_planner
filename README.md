# TripMind — AI Travel Planner with Real-Time Verification

## What is TripMind?

TripMind is a full-stack AI travel planning application that creates personalized, multi-day trip itineraries and then independently verifies every detail in real time. It uses Anthropic's Claude LLM to generate the trip plan, then dispatches 11 concurrent verification agents to check hotel prices, flight costs, activity availability, weather forecasts, safety advisories, currency rates, place existence, reviews, and more.

**The key idea:** Every verification agent has a dual-path design — it uses a paid official API (Amadeus, Booking.com, Viator, Google Places) when you provide a key, or falls back to free web scraping and public APIs. This means:

- **Zero cost to run** (beyond ~$0.01–0.05 per trip in Claude API credits)
- **No API keys required** — the app works fully out of the box
- **Optional paid APIs** upgrade data quality from "estimated" to "verified with real prices"
- **Graceful degradation** — if the Python verification service isn't running at all, the app still works with AI estimates

### Tech Stack

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | React 19, Vite, CSS Modules | 5173 |
| Backend | Node.js, Express.js | 3001 |
| Verification | Python 3.11+, FastAPI, Playwright, httpx, BeautifulSoup4 | 8000 |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) | — |
| Cache | SQLite (async, TTL-based per agent) | — |

---

## How It Works

```
 BROWSER                        NODE.JS EXPRESS (:3001)
 React 19 + Vite (:5173)       API Gateway / BFF
                                                          ANTHROPIC CLAUDE API
 9-step trip form   -------->  /api/chat/stream  -------->  Skeleton generation
 Streaming UI                  /api/verify/stream            Days generation
 PDF export                    /api/hotels/search
 Swap modals                   /api/health
                                     |
                                     v
                            PYTHON FASTAPI (:8000)
                            Verification Service

                            11 Concurrent Agents:
                             1. Weather     (Open-Meteo)          Free
                             2. Safety      (travel-advisory.info) Free
                             3. Seasonal    (Open-Meteo Climate)   Free
                             4. Currency    (Frankfurter/ECB)      Free
                             5. Places      (Google Places API or Nominatim)
                             6. Hotels      (Booking API or Playwright scraping)
                             7. Activities  (Viator API or httpx scraping)
                             8. Reviews     (Google Places API or Search scraping)
                             9. Flights     (Amadeus API or Playwright scraping)
                            10. Links       (HTTP HEAD checks)     Free
                            11. Price Trends (reuses flight + hotel agents)

                            SQLite Cache (TTL-based)
```

### Step-by-Step Flow

1. **User fills the 9-step form** — origin, destination(s), dates, travelers (adults + children ages), budget, trip vibe, dietary/accessibility/pet needs, passport country, activity level
2. **Claude generates the plan** (two API calls via Server-Sent Events):
   - *Skeleton call*: trip structure, destinations, daily overview, budget breakdown, hotel/restaurant/activity names, booking URLs
   - *Day-by-day call*: detailed itinerary for each day, using the skeleton as context
3. **Results appear immediately** in a 7-tab view (Map, Itinerary, Stays, Flights, Budget, Suggestions, Tips)
4. **Verification starts in parallel** — 11 agents run concurrently via `asyncio.gather()`:
   - Each agent: checks SQLite cache → tries official API (if key set) → tries scraper → falls back to search URLs
   - Results stream back via Server-Sent Events (SSE) as each agent finishes
   - Progress bar updates in real time (e.g., "7/11 agents complete")
5. **Verified data populates the tabs** — hotel prices replace AI estimates, flight costs appear, weather/safety badges render, review ratings show up
6. **User interacts with results** — swap hotels/restaurants, toggle currencies, select budget options (live price delta), export to PDF

### Key Patterns

- **Dual-path architecture:** Each agent checks for an API key at runtime. If set, uses the official API with scraper fallback on failure. If not set, uses free scraping directly.
- **Data quality filtering:** Frontend filters out "Search Links" fallback entries (generic search URLs with no price) from verified hotels, flights, and activities — only shows real bookable results
- **Price Trends fallback:** Charts always render — if backend returns no data, frontend generates estimated seasonal curves using the same monthly shape multipliers as the backend
- **Interactive budget:** Selectable hotel/flight options in Budget tab with live price delta badges and total recalculation
- **Specific booking links:** URL builders include hotel/activity name for property-specific search links instead of generic city searches
- **Split-prompt strategy:** Two Claude API calls (skeleton + days) to avoid token truncation
- **Server-Sent Events (SSE) streaming** for both trip generation and verification progress
- **Fan-out/fan-in concurrency** via `asyncio.gather()` for all 11 agents
- **Graceful degradation:** App works fully without the Python service (shows AI estimates)
- **Code-split PDF export:** `@react-pdf/renderer` (~1.5 MB) loaded lazily on demand

---

## Quick Start

### Prerequisites

| # | Tool | Version | Download |
|---|------|---------|----------|
| 1 | **Git** | any | https://git-scm.com/downloads |
| 2 | **Node.js** | 20+ | https://nodejs.org/ (LTS) |
| 3 | **Python** | 3.11+ | https://www.python.org/downloads/ |

You also need an **Anthropic API Key** — get one at https://console.anthropic.com/settings/keys

### Step 1 — Clone and install

```bash
git clone https://github.com/karansachdev-1012/multi_agentic_travel_planner.git
cd tripmind
npm install
```

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your Anthropic key:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Optionally add API keys for higher-reliability data (see [Environment Variables](#environment-variables)):
```
AMADEUS_API_KEY=...
AMADEUS_API_SECRET=...
BOOKING_API_KEY=...
VIATOR_API_KEY=...
GOOGLE_PLACES_API_KEY=...
```

### Step 3 — Set up Python agents

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
cd agents
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
cd ..
```
</details>

<details>
<summary><strong>Windows (Git Bash)</strong></summary>

```bash
cd agents
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
playwright install chromium
cd ..
```
</details>

<details>
<summary><strong>macOS / Linux</strong></summary>

```bash
cd agents
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
playwright install-deps  # Linux only: installs system browser libraries
cd ..
```
</details>

### Step 4 — Run

```bash
npm run dev:full    # All 3 services (frontend + backend + agents)
```

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 3001 | http://localhost:3001 |
| Agents | 8000 | http://localhost:8000 |

> **Without agents:** `npm run dev` — the app works fully, just without verified prices/weather/safety.

> **Windows note:** If `dev:full` can't find Python, activate the venv first or start agents separately: `cd agents && .venv\Scripts\python main.py`

---

## Running in Different Environments

### Option A: Development (3 separate processes)

This is the recommended way during development. All three services run independently with hot reload.

```bash
# Terminal 1: Frontend + Backend
npm run dev

# Terminal 2: Python agents (activate venv first)
cd agents
# Windows PowerShell: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python main.py
```

Frontend at http://localhost:5173, backend at http://localhost:3001, agents at http://localhost:8000.

### Option B: All-in-one development command

```bash
npm run dev:full    # Starts all 3 services in one terminal
```

> **Windows note:** If `dev:full` can't find Python, activate the venv first or use Option A.

### Option C: Without verification agents

```bash
npm run dev         # Frontend + backend only
```

The app works fully — Claude generates the trip plan, but you won't see verified prices, weather, safety, or reviews. All data shows as AI estimates. This is useful for frontend development or when you don't need verification.

### Option D: Docker

```bash
git clone https://github.com/karansachdev-1012/multi_agentic_travel_planner.git
cd tripmind
cp .env.example .env   # edit and add your ANTHROPIC_API_KEY
docker compose up --build
```

Open **http://localhost:3001** (frontend is pre-built and served by Express). Two containers: `app` (:3001) and `agents` (:8000).

### Option E: Production build (no Docker)

```bash
npm run build          # Build React to dist/
npm start              # Serve on :3001 (Express serves dist/ + API)

# In a separate terminal, start agents:
cd agents && .venv/Scripts/python main.py   # Windows
cd agents && .venv/bin/python main.py       # macOS/Linux
```

### Platform-Specific Notes

| Platform | Note |
|----------|------|
| **Windows** | Use `http://127.0.0.1:8000` (not `localhost`) for `PYTHON_SERVICE_URL` in `.env`. Node.js on Windows has a DNS resolution issue with `localhost` that causes `ECONNREFUSED`. |
| **Windows (Vite preview)** | Use `node node_modules/vite/bin/vite.js preview` instead of `npx vite preview` |
| **Linux** | Run `playwright install-deps` after `playwright install chromium` to install system browser libraries (libatk, libnss3, etc.) |
| **macOS (Apple Silicon)** | Playwright Chromium works natively on ARM64; no extra steps needed |
| **Docker** | `PYTHON_SERVICE_URL` is automatically set to `http://agents:8000` via docker-compose networking |
| **WSL2** | Works like Linux. Ensure the WSL2 distro has Python 3.11+ installed. |

---

## Verification Agents

| # | Agent | Default (Free) | With API Key | Cache |
|---|-------|---------------|-------------|-------|
| 1 | Weather | Open-Meteo | — | 3h |
| 2 | Safety | travel-advisory.info | — | 24h |
| 3 | Seasonal | Open-Meteo Climate | — | 7d |
| 4 | Currency | Frankfurter (ECB) | — | 1h |
| 5 | Places | Nominatim / OSM | Google Places API | 7d |
| 6 | Hotels | Google Hotels + Booking.com scrapers | Booking.com Partner API | 6h |
| 7 | Activities | Viator + GetYourGuide scrapers | Viator Partner API | 12h |
| 8 | Reviews | Google Search scraper | Google Places API | 48h |
| 9 | Flights | Google Flights scraper | Amadeus API | 1h |
| 10 | Links | HTTP HEAD checks | — | 24h |
| 11 | Price Trends | Reuses flight + hotel agents (12 months) | Reuses flight + hotel APIs | 24h |

**Fallback chains** (agents never fully fail):
```
Flights:    Amadeus API  →  Google Flights scraper  →  Search URLs
Hotels:     Booking API  →  Google Hotels scraper   →  Booking scraper  →  Search URLs
Activities: Viator API   →  Viator scraper          →  GetYourGuide     →  Search URLs
Reviews:    Google Places API  →  Google Search scraper
Places:     Google Places API  →  Nominatim (free)
```

**Total cost: $0 + Anthropic API credits** (~$0.01–0.05 per trip).

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Claude API key (`sk-ant-...`) |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Claude model override |
| `PORT` | No | `3001` | Express server port |
| `PYTHON_SERVICE_URL` | No | `http://127.0.0.1:8000` | Python service URL |

### Optional API Keys

These replace web scraping with official APIs for higher reliability. All are optional — the app works fully without them.

| Variable | Provider | Replaces | Sign Up |
|----------|----------|----------|---------|
| `AMADEUS_API_KEY` | Amadeus | Google Flights scraper | https://developers.amadeus.com |
| `AMADEUS_API_SECRET` | Amadeus | (both required) | |
| `BOOKING_API_KEY` | Booking.com | Google Hotels + Booking scrapers | https://www.booking.com/content/affiliates.html |
| `VIATOR_API_KEY` | Viator | Viator + GetYourGuide scrapers | https://partnerapi.viator.com |
| `GOOGLE_PLACES_API_KEY` | Google | Review scraper + place verification | https://console.cloud.google.com |

> **Windows note:** Use `http://127.0.0.1:8000` (not `localhost`) for `PYTHON_SERVICE_URL`.
> **Docker:** `PYTHON_SERVICE_URL` is automatically set to `http://agents:8000`.

---

## Project Structure

```
tripmind/
├── server.js                     Express API gateway (rate-limited)
├── package.json                  Node.js dependencies and scripts
├── vite.config.js                Vite config (dev proxy /api → :3001)
├── .env.example                  Full env template with API key docs
├── docker-compose.yml            Two services: app + agents
├── ARCHITECTURE.tex              LaTeX architecture document
│
├── src/
│   ├── App.jsx                   App shell with TripProvider
│   ├── api.js                    API client (askClaudeStream, verify, searchHotels)
│   ├── prompts.js                Claude prompt templates (skeleton + days)
│   ├── constants.js              Trip types, dietary options, occasions
│   │
│   ├── context/
│   │   └── TripContext.jsx       Global state: form, generation, verification, swaps
│   │
│   ├── hooks/
│   │   └── useVerification.js    Server-Sent Events streaming verification hook
│   │
│   ├── components/
│   │   ├── FormSteps.jsx         9-step trip wizard
│   │   ├── TripGuide.jsx         Multi-tab results (Map, Stays, Flights, Budget, Tips)
│   │   ├── PriceTrends.jsx       12-month price trend chart
│   │   ├── SwapModal.jsx         Hotel/restaurant swap with budget impact
│   │   ├── VerificationBar.jsx   Agent completion progress
│   │   ├── SafetyBadge.jsx       Travel advisory display
│   │   ├── SeasonalPanel.jsx     Seasonal intelligence card
│   │   ├── RatingBadge.jsx       Review ratings
│   │   ├── CurrencyToggle.jsx    Currency conversion
│   │   ├── PdfExport.jsx         PDF generation (lazy-loaded)
│   │   ├── VisaChecker.jsx       Visa requirement checker
│   │   └── LoadingView.jsx       Streaming generation progress
│   │
│   └── styles/                   CSS Modules
│
└── agents/                       Python verification microservice
    ├── main.py                   FastAPI app (:8000)
    ├── orchestrator.py           Parallel agent dispatcher
    ├── models.py                 Pydantic schemas (all result types)
    ├── config.py                 Agent toggles and scraping config
    ├── api_config.py             Optional API key loader
    ├── cache.py                  SQLite async cache with TTL
    │
    ├── agents/                   11 agent wrappers with caching
    │   ├── weather_agent.py      Open-Meteo forecast
    │   ├── safety_agent.py       Travel advisory scores
    │   ├── seasonal_agent.py     Climate and tourism intelligence
    │   ├── currency_agent.py     ECB exchange rates
    │   ├── place_agent.py        Google Places API → Nominatim
    │   ├── hotel_agent.py        Booking API → Google Hotels → Booking scraper
    │   ├── activity_agent.py     Viator API → Viator scraper → GetYourGuide
    │   ├── review_agent.py       Google Places API → Google Search scraper
    │   ├── flight_agent.py       Amadeus API → Google Flights scraper
    │   ├── link_agent.py         HTTP HEAD URL checks
    │   └── price_trends_agent.py 12-month flight + hotel price trends
    │
    ├── api_clients/              Official API integrations (key required)
    │   ├── amadeus.py            Amadeus OAuth2 + Flight Offers Search
    │   ├── booking_api.py        Booking.com Partner API
    │   ├── viator_api.py         Viator Partner API
    │   └── google_places.py      Google Places (reviews + verification)
    │
    ├── scrapers/                 Web scraping (no keys needed)
    │   ├── base_scraper.py       Playwright utils, anti-detection
    │   ├── google_flights.py     Google Flights (Playwright)
    │   ├── google_hotels.py      Google Hotels (Playwright)
    │   ├── booking_com.py        Booking.com (Playwright)
    │   ├── viator.py             Viator (httpx + BeautifulSoup)
    │   ├── getyourguide.py       GetYourGuide (httpx + BS4)
    │   └── google_reviews.py     Google Search reviews (httpx + BS4)
    │
    └── free_apis/                Free APIs (no keys needed)
        ├── open_meteo.py         Weather forecast + geocoding
        ├── frankfurter.py        Currency exchange rates (ECB)
        ├── nominatim.py          OpenStreetMap place lookup
        ├── travel_advisories.py  Travel safety scores
        └── seasonal_data.py      Historical climate + seasonal tips
```

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Backend + frontend (no agents) |
| `npm run dev:full` | Backend + frontend + Python agents |
| `npm run dev:client` | Frontend only (Vite) |
| `npm run dev:server` | Backend only (Express) |
| `npm run build` | Production build to `dist/` |
| `npm start` | Serve production build on :3001 |

---

## API Endpoints

### Express (:3001)

| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `POST` | `/api/chat/stream` | 10/min | Claude Server-Sent Events (SSE) proxy |
| `POST` | `/api/verify/stream` | 5/min | Verification Server-Sent Events (SSE) proxy |
| `POST` | `/api/hotels/search` | 5/min | On-demand hotel search |
| `GET` | `/api/health` | — | Health check |
| `POST` | `/api/restaurants/alternatives` | 10/min | Claude-powered restaurant swap suggestions |
| `POST` | `/api/clear-cache` | — | Clear agent cache |
| `GET` | `/api/verify/health` | — | Python service health check |

### FastAPI (:8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/verify/stream` | Run all agents (Server-Sent Events per-agent updates) |
| `POST` | `/verify` | Run all agents (full JSON response) |
| `POST` | `/hotels/search` | On-demand hotel search |
| `GET` | `/health` | Service health + cache stats |

---

## Deployment (Cloud)

Deploy the two Docker containers to any cloud platform:

| Container | Port | Required Env Vars |
|-----------|------|-------------------|
| `app` | 3001 | `ANTHROPIC_API_KEY`, `PYTHON_SERVICE_URL` (internal URL to agents) |
| `agents` | 8000 | (optional API keys) |

```bash
docker compose up --build
```

Tested on: Railway, Render, Fly.io, AWS ECS, Google Cloud Run, Azure Container Apps.

---

## Known Limitations (Scraper Mode)

When running without API keys, data comes from web scraping which has inherent reliability issues:

| Source | Issue | Impact | Fix |
|--------|-------|--------|-----|
| Google Hotels (Playwright) | Google actively blocks headless browsers | Hotels tab shows AI suggestions instead of verified results | Add `BOOKING_API_KEY` |
| Google Flights (Playwright) | Same anti-bot detection | Flights tab shows AI estimates | Add `AMADEUS_API_KEY` + `AMADEUS_API_SECRET` |
| Viator/GYG (httpx) | JS-rendered pages return empty HTML to plain HTTP requests | Activities show search links instead of direct booking URLs | Add `VIATOR_API_KEY` |
| Price Trends | Depends on flight + hotel scrapers for baseline | Shows frontend-estimated seasonal curves (still useful) | Add flight + hotel API keys |

**The app always works** — when scrapers fail, it gracefully degrades to AI estimates, search links, and seasonal estimates. API keys simply upgrade the data quality from "estimated" to "verified with real prices and direct booking links."

**Recommended free APIs for production:**
- **SerpAPI** (250 free/month) — replaces both Google Hotels and Google Flights scrapers, returns real booking URLs
- **Amadeus** (2,000 free/month) — reliable flight prices
- **Viator Partner API** (free, approval required) — real activity prices and booking links

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ANTHROPIC_API_KEY is not set` | Create `.env` from `.env.example` and set your key |
| `API error 401` | Invalid key — check at https://console.anthropic.com/settings/keys |
| `API error 429` | Rate limited — wait 30 seconds |
| Verification offline | Start agents: `cd agents && .venv/Scripts/python main.py` |
| Playwright not found | Run `playwright install chromium` in activated venv |
| Viator/GYG 403 | Expected — anti-bot; fallback URLs provided automatically |
| Windows: agents unreachable | Set `PYTHON_SERVICE_URL=http://127.0.0.1:8000` in `.env` |
| Port in use | Kill processes on 3001/5173/8000 |

### Clear Cache

```bash
curl -X POST http://localhost:3001/api/clear-cache
# or delete directly:
rm -f agents/cache.db
```

---

## License

Private project. All rights reserved.
