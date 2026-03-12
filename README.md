# TripMind — AI Travel Planner with Real-Time Verification

An AI-powered travel planning app that generates personalized trip itineraries using Claude (Anthropic) and verifies every detail through 10 concurrent verification agents powered by web scraping and free APIs.

---

## Architecture

```
 BROWSER                        NODE.JS EXPRESS (:3001)
 React 19 + Vite (:5173)       API Gateway / BFF
                                                          ANTHROPIC CLAUDE API
 9-step trip form   -------->  /api/chat/stream  -------->  Skeleton generation
 Streaming UI                  /api/verify/stream            Days generation
 PDF export                    /api/health
 Verification badges           /api/clear-cache
                                     |
                                     v
                            PYTHON FASTAPI (:8000)
                            Verification Service

                            10 Concurrent Agents:
                             1. Weather     (Open-Meteo)
                             2. Safety      (travel-advisory.info)
                             3. Seasonal    (Open-Meteo Climate)
                             4. Currency    (Frankfurter/ECB)
                             5. Places      (Nominatim/OSM)
                             6. Hotels      (Playwright scraping)
                             7. Activities  (httpx scraping)
                             8. Reviews     (Google Search)
                             9. Flights     (Playwright scraping)
                            10. Links       (HTTP HEAD checks)

                            SQLite Cache (TTL-based)
```

**Key patterns:**
- Split-prompt strategy: two Claude API calls (skeleton + days) to avoid token truncation
- SSE streaming for both trip generation and verification progress
- Fan-out/fan-in concurrency via `asyncio.gather()` for all 10 agents
- Graceful degradation: app works fully without the Python service (shows AI estimates)
- Code-split PDF export: `@react-pdf/renderer` (~1.5 MB) loaded lazily on demand
- All user form inputs (children, passport, climate, workcation, dietary, etc.) personalize both the AI prompts and the verification agents

---

## Quick Start (without Docker)

### Prerequisites

You need three things installed before running TripMind:

| # | Tool | Version | What it's for | Download |
|---|------|---------|---------------|----------|
| 1 | **Git** | any | Clone the repository | https://git-scm.com/downloads |
| 2 | **Node.js** | 20 or newer | Frontend + backend server | https://nodejs.org/ (pick LTS) |
| 3 | **Python** | 3.11 or newer | Verification agents | https://www.python.org/downloads/ |

You also need an **Anthropic API Key** (for Claude AI). Get one at https://console.anthropic.com/settings/keys — it starts with `sk-ant-`.

> **How to check if you have them installed:**
> ```bash
> git --version    # should print git version X.X.X
> node --version   # should print v20.X.X or higher
> python --version # should print Python 3.11+ (on Mac/Linux use python3 --version)
> ```

### Step 1 — Clone the repository

```bash
git clone https://github.com/karansachdev-1012/multi_agentic_travel_planner.git
cd tripmind
```

### Step 2 — Install Node.js dependencies

```bash
npm install
```

This reads `package.json` and downloads all JavaScript dependencies into `node_modules/` (takes 30–60 seconds).

### Step 3 — Configure your API key

```bash
cp .env.example .env
```

Open `.env` in any text editor and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **Important:** Never commit `.env` to Git — it contains your secret API key. The `.gitignore` already excludes it.

### Step 4 — Set up Python verification agents

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
<summary><strong>Windows (Git Bash / MSYS2)</strong></summary>

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
<summary><strong>macOS</strong></summary>

```bash
cd agents
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cd ..
```
</details>

<details>
<summary><strong>Linux (Ubuntu / Debian)</strong></summary>

```bash
cd agents
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
playwright install-deps      # installs system browser libraries
cd ..
```
</details>

### Step 5 — Run all 3 services

**With verification agents (recommended):**

```bash
npm run dev:full
```

> **Windows note:** Make sure your Python venv is activated in the terminal before running this, or the `dev:agents` script won't find the dependencies. Alternatively, start the agents manually in a separate terminal:
> ```powershell
> cd agents
> .venv\Scripts\python main.py
> ```
> Then run `npm run dev` in the project root.

**Without verification agents:**

```bash
npm run dev
```

The app works fully without the Python service — it just won't show verified prices, weather, safety, or place badges.

### What starts

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Frontend | 5173 | http://localhost:5173 | React + Vite with HMR |
| Backend | 3001 | http://localhost:3001 | Express API gateway |
| Verification | 8000 | http://localhost:8000 | Python FastAPI agents |

Open **http://localhost:5173** in your browser.

---

## Quick Start (with Docker)

### Prerequisites

- **Git** — https://git-scm.com/downloads
- **Docker** and **Docker Compose** — https://docs.docker.com/get-docker/
- **Anthropic API Key** — https://console.anthropic.com/settings/keys

### Step 1 — Clone the repository

```bash
git clone https://github.com/karansachdev-1012/multi_agentic_travel_planner.git
cd tripmind
```

### Step 2 — Configure your API key

```bash
cp .env.example .env
```

Edit `.env` and paste your Anthropic API key.

### Step 3 — Build and start

```bash
docker compose up --build
```

This builds two containers:

| Container | Port | Description |
|-----------|------|-------------|
| `app` | 3001 | Node.js Express serving the built React frontend |
| `agents` | 8000 | Python FastAPI with Playwright Chromium |

Open **http://localhost:3001** in your browser.

> **Note:** In Docker mode the frontend is pre-built and served by Express on port 3001. There is no separate Vite dev server.

### Stop

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose up --build
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Your Anthropic API key (`sk-ant-...`) |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Claude model to use |
| `PORT` | No | `3001` | Express server port |
| `PYTHON_SERVICE_URL` | No | `http://127.0.0.1:8000` | URL of the Python verification service |

**Notes:**
- In Docker, `PYTHON_SERVICE_URL` is automatically set to `http://agents:8000`.
- On Windows, use `http://127.0.0.1:8000` (not `localhost`) for `PYTHON_SERVICE_URL` to avoid Node.js IPv6 issues.

---

## Project Structure

```
tripmind/
├── index.html                    React mount point
├── vite.config.js                Vite config (dev proxy /api -> :3001)
├── package.json                  Node.js dependencies and scripts
├── server.js                     Express API gateway (rate-limited)
├── Dockerfile                    Multi-stage: build React + serve with Express
├── docker-compose.yml            Two services: app + agents
├── .env                          API keys (gitignored)
├── .env.example                  Template for .env
├── .gitignore                    Git ignore rules
├── .dockerignore                 Docker ignore rules
│
├── src/
│   ├── main.jsx                  React entry point
│   ├── App.jsx                   App shell with TripProvider
│   ├── api.js                    API client (askClaudeStream, verify)
│   ├── prompts.js                Claude prompt templates (skeleton + days)
│   ├── constants.js              Trip types, dietary options, occasions
│   │
│   ├── context/
│   │   └── TripContext.jsx       React Context: form state, generation, verification
│   │
│   ├── hooks/
│   │   └── useVerification.js    SSE streaming verification hook
│   │
│   ├── components/
│   │   ├── FormSteps.jsx         9-step trip wizard
│   │   ├── TripGuide.jsx         Trip results with tabs and verification overlays
│   │   ├── LoadingView.jsx       Streaming generation progress
│   │   ├── VerificationBar.jsx   Agent status bar with score
│   │   ├── SafetyBadge.jsx       Travel advisory display
│   │   ├── SeasonalPanel.jsx     Seasonal intelligence card
│   │   ├── RatingBadge.jsx       Google review ratings
│   │   ├── PdfExport.jsx         PDF generation (lazy-loaded)
│   │   ├── Chip.jsx              Reusable chip/tag component
│   │   ├── VBadge.jsx            Verification badge
│   │   ├── CurrencyToggle.jsx    Currency conversion display
│   │   ├── VisaChecker.jsx       Live visa requirement checker
│   │   └── ActivityCheckboxes.jsx AI-generated activity suggestions
│   │
│   └── styles/                   CSS Modules (*.module.css)
│       ├── variables.css         Design tokens (colors, fonts)
│       ├── global.css            Global styles and resets
│       ├── App.module.css
│       ├── FormSteps.module.css
│       ├── TripGuide.module.css
│       ├── LoadingView.module.css
│       ├── VerificationBar.module.css
│       ├── SafetyBadge.module.css
│       ├── SeasonalPanel.module.css
│       ├── RatingBadge.module.css
│       ├── Chip.module.css
│       ├── VBadge.module.css
│       ├── CurrencyToggle.module.css
│       ├── VisaChecker.module.css
│       └── ActivityCheckboxes.module.css
│
└── agents/                       Python verification microservice
    ├── main.py                   FastAPI app (:8000) with SSE streaming
    ├── orchestrator.py           Parallel agent dispatcher (asyncio.gather)
    ├── models.py                 Pydantic request/response schemas
    ├── config.py                 Agent toggles and scraping config
    ├── cache.py                  SQLite async cache with TTL
    ├── requirements.txt          Python dependencies
    ├── Dockerfile                Python 3.12 + Playwright Chromium
    │
    ├── agents/                   Verification agent wrappers (with caching)
    │   ├── weather_agent.py      Open-Meteo forecast
    │   ├── safety_agent.py       Travel advisory scores
    │   ├── seasonal_agent.py     Climate and tourism intelligence
    │   ├── currency_agent.py     ECB exchange rates
    │   ├── place_agent.py        OSM place verification
    │   ├── hotel_agent.py        Google Hotels -> Booking.com -> fallback URLs
    │   ├── activity_agent.py     Viator -> GetYourGuide -> fallback URLs
    │   ├── review_agent.py       Google Search review ratings
    │   ├── flight_agent.py       Google Flights -> search URLs
    │   └── link_agent.py         HTTP HEAD URL checks
    │
    ├── scrapers/                 Web scraping modules
    │   ├── base_scraper.py       Playwright utils, user-agent rotation
    │   ├── google_hotels.py      Google Hotels (Playwright)
    │   ├── booking_com.py        Booking.com (Playwright)
    │   ├── google_flights.py     Google Flights (Playwright)
    │   ├── viator.py             Viator (httpx + BeautifulSoup)
    │   ├── getyourguide.py       GetYourGuide (httpx + BeautifulSoup)
    │   └── google_reviews.py     Google Search reviews (httpx + BS4)
    │
    ├── free_apis/                Free API integrations (no keys needed)
    │   ├── open_meteo.py         Weather forecast + geocoding
    │   ├── frankfurter.py        Currency exchange rates (ECB)
    │   ├── nominatim.py          OpenStreetMap place lookup
    │   ├── travel_advisories.py  Travel safety scores
    │   └── seasonal_data.py      Historical climate + seasonal tips
    │
    └── utils/                    Shared utilities
        └── rate_limiter.py       Rate limiting for API calls
```

---

## API Endpoints

### Express Backend (:3001)

| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/health` | 60/min | Health check and API key status |
| `POST` | `/api/chat` | 10/min | Claude API proxy (non-streaming) |
| `POST` | `/api/chat/stream` | 10/min | Claude API proxy (SSE streaming) |
| `POST` | `/api/verify` | 5/min | Verification proxy (non-streaming) |
| `POST` | `/api/verify/stream` | 5/min | Verification proxy (SSE streaming) |
| `POST` | `/api/clear-cache` | — | Clear Python service cache |
| `GET` | `/api/verify/health` | — | Python service health check |

### Python FastAPI (:8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health and cache stats |
| `POST` | `/verify` | Run all agents (returns full result) |
| `POST` | `/verify/stream` | Run all agents (SSE: per-agent updates) |
| `POST` | `/clear-cache` | Purge SQLite cache |

---

## Verification Agents

| # | Agent | Data Source | Cache TTL | What It Verifies |
|---|-------|------------|-----------|------------------|
| 1 | Weather | Open-Meteo API | 3h | Daily forecast: temp, rain, icons |
| 2 | Safety | travel-advisory.info | 24h | Country risk score, travel advice |
| 3 | Seasonal | Open-Meteo Climate | 7d | Monthly averages, tourism level, tips |
| 4 | Currency | Frankfurter (ECB) | 1h | Exchange rates for destination currencies |
| 5 | Places | Nominatim / OSM | 7d | Restaurant/attraction existence and coordinates |
| 6 | Hotels | Google Hotels + Booking.com | 6h | Real prices, ratings, booking URLs |
| 7 | Activities | Viator + GetYourGuide | 12h | Activity prices, ratings, booking URLs |
| 8 | Reviews | Google Search | 48h | Place ratings, review counts, snippets |
| 9 | Flights | Google Flights | 1h | Flight prices, airlines, durations |
| 10 | Links | HTTP HEAD | — | URL reachability for all booking links |

**Fallback chains** (scraping agents never fully fail):
```
Hotels:     Google Hotels  ->  Booking.com  ->  Search URLs
Activities: Viator         ->  GetYourGuide ->  Search URLs
Flights:    Google Flights ->  Kayak/Skyscanner search URLs
```

**Total cost: $0 + Anthropic API credits** (~$0.01-0.05 per trip generation).

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start backend + frontend (no agents) |
| `npm run dev:full` | Start backend + frontend + Python agents |
| `npm run dev:client` | Frontend only (Vite) |
| `npm run dev:server` | Backend only (Express) |
| `npm run build` | Production build to `dist/` |
| `npm start` | Serve production build on :3001 |

---

## Deployment

### Docker Hub / Container Registry

Build and push images for deployment on AWS ECS, Google Cloud Run, Azure Container Apps, or any container platform:

```bash
# Build both images
docker build -t tripmind-app .
docker build -t tripmind-agents ./agents

# Tag for your registry (Docker Hub example)
docker tag tripmind-app yourusername/tripmind-app:latest
docker tag tripmind-agents yourusername/tripmind-agents:latest

# Push
docker push yourusername/tripmind-app:latest
docker push yourusername/tripmind-agents:latest
```

Then deploy both containers with:
- `tripmind-app` on port **3001** with env vars `ANTHROPIC_API_KEY` and `PYTHON_SERVICE_URL`
- `tripmind-agents` on port **8000**

---

### Railway

1. Push your code to GitHub.
2. Create two services on [Railway](https://railway.app):

**Service 1 — App (Node.js):**
| Setting | Value |
|---------|-------|
| Root directory | `/` (project root) |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Port | `3001` |
| Env vars | `ANTHROPIC_API_KEY=your-key` |
| | `PYTHON_SERVICE_URL=http://agents.railway.internal:8000` |

**Service 2 — Agents (Python):**
| Setting | Value |
|---------|-------|
| Root directory | `/agents` |
| Build command | `pip install -r requirements.txt && playwright install chromium && playwright install-deps` |
| Start command | `python main.py` |
| Port | `8000` |

---

### Render

1. Push your code to GitHub.
2. Create two Web Services on [Render](https://render.com):

**Service 1 — App:**
| Setting | Value |
|---------|-------|
| Environment | Node |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Env vars | `ANTHROPIC_API_KEY`, `PYTHON_SERVICE_URL` |

**Service 2 — Agents:**
| Setting | Value |
|---------|-------|
| Environment | Python 3 |
| Root directory | `agents` |
| Build command | `pip install -r requirements.txt && playwright install chromium && playwright install-deps` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port 8000` |

---

### Fly.io

```bash
# Deploy the Node.js app
fly launch --name tripmind-app
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key
fly secrets set PYTHON_SERVICE_URL=http://tripmind-agents.internal:8000
fly deploy

# Deploy the Python agents
cd agents
fly launch --name tripmind-agents
fly deploy
```

---

### AWS ECS / Google Cloud Run / Azure Container Apps

Use the Docker images built above. Configure:

| Container | Port | Required Env Vars |
|-----------|------|-------------------|
| `tripmind-app` | 3001 | `ANTHROPIC_API_KEY`, `PYTHON_SERVICE_URL` (internal URL of agents container) |
| `tripmind-agents` | 8000 | *(none)* |

Make sure the two containers can reach each other over the internal network. Set `PYTHON_SERVICE_URL` to the agents container's internal address.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ANTHROPIC_API_KEY is not set` | Create `.env` from `.env.example` and paste your real key |
| `API error 401` | Invalid key — check at https://console.anthropic.com/settings/keys |
| `API error 429` | Rate limited — wait 30 seconds and try again |
| `Verification service: offline` | Start agents separately (see below) |
| `Playwright browser not found` | Run `playwright install chromium` inside the activated venv |
| `Viator/GetYourGuide 403` | Expected — anti-bot blocking; fallback URLs are provided automatically |
| Windows: Python service unreachable | Set `PYTHON_SERVICE_URL=http://127.0.0.1:8000` in `.env` |
| Port already in use | Kill processes on those ports (see Force Stop below) |
| `npm run dev:full` agents fail | Activate the Python venv first, or start agents manually in a separate terminal |

### Starting Agents Separately

If `npm run dev:full` can't find Python or the dependencies:

**Windows (PowerShell):**
```powershell
cd agents
.venv\Scripts\activate
python main.py
```

**macOS / Linux:**
```bash
cd agents
source .venv/bin/activate
python main.py
```

Then in a separate terminal, run `npm run dev` from the project root.

### Force Stop All Services

**Windows (PowerShell):**
```powershell
Get-Process -Name node,python -ErrorAction SilentlyContinue | Stop-Process -Force
```

**macOS / Linux:**
```bash
kill $(lsof -ti:3001,5173,8000) 2>/dev/null
```

### Clear Verification Cache

```bash
curl -X POST http://localhost:3001/api/clear-cache
```

Or delete the cache file directly:

```bash
rm -f agents/cache.db
```

---

## License

Private project. All rights reserved.
