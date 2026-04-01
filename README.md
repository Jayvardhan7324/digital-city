# Smart City Intelligence Dashboard — Bengaluru

A full-stack smart-city analytics platform that layers real urban datasets onto an interactive map and uses **Groq LLM** to generate actionable infrastructure insights for Bengaluru city officials.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Map | Leaflet, leaflet.heat, leaflet.markercluster |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.11+), Uvicorn |
| AI / LLM | Groq API — `llama-3.3-70b-versatile` |
| Air Quality | AQICN API (live AQI stations) |
| Geo | GeoPandas, Shapely |

---

## Project Structure

```
digital_city/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS, router mounts
│   │   ├── models/
│   │   │   ├── report.py         # Pydantic models for citizen reports
│   │   │   └── grid.py           # GridPoint model (lat, lng, intensity, label, color)
│   │   ├── routes/
│   │   │   ├── aqi.py            # GET /aqi/stations  (live AQICN data)
│   │   │   ├── heatmap.py        # GET /heatmap/{layer_id}
│   │   │   ├── emergency.py      # GET /emergency/*
│   │   │   ├── insights.py       # GET /insights/, /insights/ai
│   │   │   ├── reports.py        # POST/GET /reports/
│   │   │   ├── datasets.py       # GET /datasets/, /datasets/{id}
│   │   │   ├── traffic.py        # GET /traffic/route
│   │   │   └── kml.py            # GET /kml/{layer_id}
│   │   ├── services/
│   │   │   ├── heatmap_engine.py # All CSV loaders + layer dispatcher
│   │   │   ├── groq_service.py   # Groq LLM integration
│   │   │   ├── data_service.py   # Pothole CSV + synthetic drainage
│   │   │   ├── coverage_engine.py# Emergency facility proximity
│   │   │   ├── routing_service.py# Dijkstra pathfinding
│   │   │   └── osm_service.py    # Live OSM facilities
│   │   └── data/
│   │       ├── bengaluru_potholes.csv
│   │       └── ncrb_crime_2023.py
│   ├── .env                      # API keys (committed — private repo)
│   └── requirements.txt
│
├── datasets/                     # Real Bengaluru datasets
│   ├── bengaluru_crime_data.csv
│   ├── bengaluru_traffic_data.csv
│   ├── bengaluru_potholes.csv
│   ├── garbage_dump_banglore.csv
│   ├── btp_2025_station_wise.csv
│   ├── stp.csv.csv
│   ├── street_dogs_banglore.csv
│   ├── tax_collection_with_coords.csv
│   ├── population_with_latlon.csv
│   ├── bescom_with_latlon.csv
│   ├── weather_stations_with_coords.csv
│   └── automated_weather_stations_banglore.csv
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main dashboard — sidebar, layers, simulation, chat
│   │   │   └── layout.tsx
│   │   └── components/
│   │       ├── MapView.tsx       # All map rendering (heatmaps, dots, circles, simulation)
│   │       ├── InsightCard.tsx   # Weakness card (severity + recommendation)
│   │       ├── GroqInsightButton.tsx
│   │       ├── ReportModal.tsx   # Click-to-report modal
│   │       └── DatasetSelector.tsx
│   └── package.json
│
└── README.md
```

---

## Map Layers

| Layer | Visual | Data Source | Endpoint |
|---|---|---|---|
| Traffic | Heatmap (yellow) | `bengaluru_traffic_data.csv` | `/heatmap/traffic` |
| Crime | Red dots | `bengaluru_crime_data.csv` | `/heatmap/crime` |
| Crime (NCRB 2023) | Heatmap (red) | `ncrb_crime_2023.py` | `/heatmap/crime_ncrb` |
| Garbage Dumps | Green dots | `garbage_dump_banglore.csv` | `/heatmap/garbage_dump` |
| Potholes | Orange dots | `bengaluru_potholes.csv` | `/heatmap/pothole` |
| Drainage | Blue dots | Synthetic (zone-based) | `/heatmap/drainage` |
| STP Plants | Teal dots | `stp.csv.csv` | `/heatmap/stp` |
| Street Dogs | Heatmap (orange) | `street_dogs_banglore.csv` | `/heatmap/street_dogs` |
| Road Crashes | Red dots | `btp_2025_station_wise.csv` | `/heatmap/crashes` |
| Tax Collection | Amber circles | `tax_collection_with_coords.csv` (latest FY) | `/heatmap/tax_collection` |
| Population Density | Blue-indigo circles | `population_with_latlon.csv` | `/heatmap/population` |
| BESCOM Substations | Orange dots | `bescom_with_latlon.csv` | `/heatmap/bescom` |
| Weather Stations | Cyan dots | `weather_stations_with_coords.csv` | `/heatmap/weather_station` |
| Air Quality (AQI) | Colour-coded circles | Live — AQICN API | `/aqi/stations` |

### AQI Colour Scale
| AQI Range | Category | Colour |
|---|---|---|
| 0–50 | Good | Green |
| 51–100 | Moderate | Yellow |
| 101–150 | Unhealthy for Sensitive Groups | Orange |
| 151–200 | Unhealthy | Red |
| 201–300 | Very Unhealthy | Purple |
| 300+ | Hazardous | Maroon |

All circle/dot layers show a **hover tooltip** with detailed data (ward name, collection amount, population breakdown, voltage class, AQI value, etc.).

---

## Simulation

### Emergency Response Simulation
Click the **Crime** or **Rain** button in the sidebar, then click anywhere on the map to simulate an emergency incident. The dashboard shows:
- Nearest responders (police / fire / hospital) with ETA
- Response lines colour-coded by responder type
- Under-served zones flagged with delay warnings

---

## Setup & Running

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend

```powershell
cd backend

# One-time setup
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload --port 8000
```

API runs at `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Environment Variables

All keys are pre-filled in `backend/.env` (private repo):

```env
GROQ_API_KEY=...           # Groq LLM — AI insights & chat
OPENWEATHER_API_KEY=...    # OpenWeather (available for future use)
AQICN_TOKEN=...            # AQICN — live AQI station data
```

To get your own keys:
- **Groq**: [console.groq.com](https://console.groq.com) (free tier)
- **AQICN**: [aqicn.org/api](https://aqicn.org/api) (free token)

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/heatmap/{layer_id}` | Intensity points for any layer |
| GET | `/aqi/stations` | Live AQI stations for Bengaluru bounding box |
| GET | `/insights/` | Ranked infrastructure weakness report |
| GET | `/insights/ai` | Groq LLM city analysis |
| POST | `/insights/chat` | Ask anything about Bengaluru |
| GET | `/datasets/` | List available datasets |
| GET | `/datasets/{id}` | Raw dataset points |
| GET | `/emergency/simulate?lat=&lng=&mode=crime` | Emergency response simulation |
| GET | `/emergency/facilities-osm?city=Bangalore&amenity=all` | Live OSM facilities |
| POST | `/reports/` | Submit citizen report |
| GET | `/traffic/route?from_lat=&from_lng=&to_lat=&to_lng=` | Route + ETA |
| GET | `/kml/{layer_id}` | Export layer as KML |
