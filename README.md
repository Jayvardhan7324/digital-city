# Smart City Intelligence Dashboard — Bengaluru

A full-stack smart-city analytics platform that layers real and synthetic urban data onto an interactive map, then uses **Groq LLM** to generate actionable infrastructure insights for Bengaluru city officials.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Map | Leaflet + react-leaflet, leaflet.heat (heatmaps) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.11+), Uvicorn |
| AI / LLM | Groq API — `llama-3.3-70b-versatile` |
| Geo | GeoPandas, Shapely, GeoAlchemy2 |
| Data | Real pothole CSV (788 records), synthetic crime & drainage |
| Infra | Docker Compose (PostgreSQL + PostGIS — optional) |

---

## Project Structure

```
digital_city/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS, router mounts
│   │   ├── models/
│   │   │   ├── report.py         # Pydantic models for citizen reports
│   │   │   └── grid.py           # GridPoint model (lat, lng, intensity)
│   │   ├── routes/
│   │   │   ├── flood.py          # GET /flood/risk
│   │   │   ├── traffic.py        # GET /traffic/route
│   │   │   ├── emergency.py      # GET /emergency/*
│   │   │   ├── heatmap.py        # GET /heatmap/{layer_id}
│   │   │   ├── insights.py       # GET /insights/, /insights/ai, /insights/summary
│   │   │   ├── reports.py        # POST/GET /reports/
│   │   │   └── datasets.py       # GET /datasets/, /datasets/{id}
│   │   ├── services/
│   │   │   ├── groq_service.py   # Groq LLM integration
│   │   │   ├── data_service.py   # CSV loader + synthetic data generators
│   │   │   ├── heatmap_engine.py # Density map builder (real + synthetic)
│   │   │   ├── risk_engine.py    # Flood simulation (elevation + rainfall)
│   │   │   ├── coverage_engine.py# Emergency facility proximity analysis
│   │   │   ├── routing_service.py# Dijkstra pathfinding
│   │   │   └── osm_service.py    # OSM facilities (fire, police, hospitals)
│   │   └── data/
│   │       ├── bengaluru_potholes.csv   # Real pothole dataset (788 records)
│   │       └── ncrb_crime_2023.py       # NCRB 2023 Karnataka crime statistics
│   ├── .env                      # API keys (see Setup)
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main dashboard (sidebar + map + insights)
│   │   │   ├── layout.tsx        # Root layout
│   │   │   └── globals.css       # Tailwind + custom glass-panel styles
│   │   └── components/
│   │       ├── MapView.tsx           # Leaflet map with heatmap/flood/facility layers
│   │       ├── DatasetSelector.tsx   # Top-left dataset picker overlay
│   │       ├── InsightCard.tsx       # Weakness card (severity badge + recommendation)
│   │       ├── GroqInsightButton.tsx # Triggers AI analysis via Groq
│   │       ├── ReportModal.tsx       # Click-to-report modal (lat/lng prefilled)
│   │       └── ui/button.tsx         # shadcn button primitive
│   └── package.json
│
├── docker-compose.yml            # PostgreSQL + PostGIS (optional persistence)
└── README.md
```

---

## Data Pipeline

```
bengaluru_potholes.csv  ──► data_service.load_potholes()
                                │
ncrb_crime_2023.py      ──► heatmap_engine._get_ncrb_layer()
                                │
Synthetic generators     ──► data_service.generate_crime_data()
(crime, drainage)               generate_drainage_data()
                                │
                                ▼
                    heatmap_engine.get_layer(layer_id)
                         │               │
                   /heatmap/{id}    /datasets/{id}
                         │               │
                    MapView.tsx    DatasetSelector.tsx
                  (leaflet.heat)   (heatmap overlay)
                         │
                         ▼
              insights.py._build_summary()
                         │
                   Groq LLM call
                (llama-3.3-70b-versatile)
                         │
                         ▼
              InsightCard.tsx (ranked weaknesses)
```

### Data Sources

| Dataset | Source | Records | Notes |
|---|---|---|---|
| Potholes | `bengaluru_potholes.csv` | 788 real | Category 0–3 → Low/Medium/High/Critical |
| Crime (Synthetic) | `data_service.py` | ~239 | Zone-based, reproducible seed |
| Crime (NCRB 2023) | `ncrb_crime_2023.py` | ~150 pts | Karnataka district + Bangalore zone data |
| Drainage | `data_service.py` | ~159 | 8 zones, 4 issue states |
| Flood risk | `risk_engine.py` | dynamic | Elevation model + rainfall slider |
| OSM Facilities | Overpass API | live | Fire, hospital, police, clinic, pharmacy |

---

## Setup & Running

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier works)

### What is Uvicorn?

Uvicorn is the web server that runs the FastAPI backend. Think of it like "npm run dev" but for Python — it starts a local server, watches for file changes, and restarts automatically. You only need it running while you use the app.

### 1. Backend (Windows PowerShell)

```powershell
cd backend

# 1. Create a virtual environment (one-time setup)
python -m venv venv

# 2. Activate it  (you need to do this every time you open a new terminal)
venv\Scripts\activate
# You'll see (venv) appear at the start of your prompt

# 3. Install Python dependencies (one-time)
pip install -r requirements.txt

# 4. Add your Groq API key
# Open backend\.env and set:  GROQ_API_KEY=gsk_your_key_here

# 5. Start the backend server
uvicorn app.main:app --reload --port 8000
```

The backend is now running at `http://localhost:8000`.
- Interactive API docs: `http://localhost:8000/docs`
- To stop it: press `Ctrl+C` in the terminal
- To restart: just run the `uvicorn` command again (venv must be active)

**Tip:** Keep this terminal open while using the app. Open a second terminal for the frontend.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 3. (Optional) PostgreSQL + PostGIS

```bash
docker-compose up -d
```

The backend currently uses in-memory storage. PostGIS is available for future persistence.

---

## Features

### Map Layers (sidebar toggles)
| Layer | Data | Endpoint |
|---|---|---|
| Flood Risk | Elevation + rainfall model | `/flood/risk?rainfall=80` |
| Traffic | Synthetic density | `/heatmap/traffic` |
| Crime Density | Synthetic or NCRB 2023 | `/heatmap/crime` or `/heatmap/crime_ncrb` |
| Litter | Synthetic | `/heatmap/litter` |
| Potholes | **Real CSV data** | `/heatmap/pothole` |
| Drainage | Synthetic | `/heatmap/drainage` |

### Crime Database Selector
When the **Crime Density** layer is active, a floating panel appears top-left on the map to switch between:
- **Synthetic Data** — zone-based generated incidents (reproducible)
- **NCRB 2023** — Karnataka official crime statistics by district + Bangalore zone breakdown

### Dataset Overlay (top-left dropdown)
Independent of the layer heatmap, you can load raw dataset points as an overlay:
`Potholes · Crime (Synthetic) · Crime (NCRB) · Drainage · Litter`

### AI Insights (Groq)
Click **"Run AI Analysis"** in the Insights panel to call Groq's `llama-3.3-70b-versatile` with a structured city data summary. The LLM cross-references pothole hotspots, crime zones, and drainage failures to produce:
- Top 5 infrastructure weaknesses ranked by severity
- Responsible civic body (BBMP / BDA / BWSSB etc.)
- Affected population estimate
- SMART (time-bound) recommendation per weakness
- Overall city health narrative

### Citizen Reporting
Click anywhere on the map → fill in category + description → submits to `/reports/` and refreshes insights.

### Emergency Coverage
Enter any lat/lng in the Emergency tab to get nearest fire station, hospital, and police post with distance (km) and ETA (minutes).

### Rainfall Simulation
Drag the rainfall slider (0–200 mm) to dynamically recompute flood risk zones across Bengaluru.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/flood/risk?rainfall=N` | Flood risk GeoJSON |
| GET | `/heatmap/{layer_id}` | Heatmap intensity points |
| GET | `/insights/` | Static ranked weakness report |
| GET | `/insights/ai` | **Groq LLM** city analysis |
| GET | `/insights/summary` | Raw data summary used for AI |
| GET | `/datasets/` | List available datasets |
| GET | `/datasets/{id}` | Dataset points (potholes/crime/drainage) |
| GET | `/emergency/coverage?lat=&lng=` | Nearest facilities + ETA |
| GET | `/emergency/facilities-osm?city=Bangalore&amenity=all` | Live OSM facilities |
| POST | `/reports/` | Submit citizen report |
| GET | `/reports/` | List all reports |
| GET | `/traffic/route?from_lat=&from_lng=&to_lat=&to_lng=` | Route + ETA |

---

## Environment Variables

```env
# backend/.env
GROQ_API_KEY=gsk_...          # Required for AI insights
OPENWEATHER_API_KEY=...       # Optional (weather data)
```

---

## Adding Your Groq API Key

1. Go to [console.groq.com](https://console.groq.com) → API Keys → Create key
2. Open `backend/.env`
3. Replace the placeholder:
   ```
   GROQ_API_KEY=gsk_your_actual_key_here
   ```
4. Restart the backend (`uvicorn app.main:app --reload --port 8000`)
5. Click **"Run AI Analysis"** in the dashboard

The free Groq tier supports ~30 requests/minute on `llama-3.3-70b-versatile`, which is more than enough for this use case.
