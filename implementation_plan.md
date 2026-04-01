# Smart City Intelligence System Implementation Plan

## Goal Description
Build a full-stack smart city decision-support system designed to monitor and analyze infrastructure weaknesses. The system will feature a 3D city map interface and a backend risk/analysis engine to simulate scenarios like flood risks, traffic bottlenecks, emergency coverage gaps, and citizen-reported issues (litter, potholes). 

The goal is to provide actionable insights such as a "City Weakness Report" that helps authorities identify the top infrastructure gaps.

## User Review Required
> [!IMPORTANT]
> - **PostGIS Database Setup**: We will need PostgreSQL with PostGIS enabled. I recommend we set this up using Docker (`docker-compose.yml`) to make local development simpler. Is this acceptable?
> - **Routing Integration**: We will implement a custom Dijkstra's algorithm instead of OSRM.
> - **Cesium Ion Token**: Using the user-provided token.
> - **OpenWeather API Key**: Using the user-provided API key.

## Proposed Changes

### 1. Root Configuration & Project Layout
We will split the workspace (`c:\Users\jayva\Desktop\digital_city`) into two main folders: `frontend/` and `backend/`. Additionally, we'll provide a `docker-compose.yml` at the root for easy database setup.

#### [NEW] `docker-compose.yml`
Sets up a PostgreSQL database with the `postgis/postgis` image.

### 2. Backend (FastAPI)
The backend will serve geographic data and compute risks dynamically.

#### [NEW] `backend/requirements.txt`
Dependencies including `fastapi`, `uvicorn`, `geopandas`, `shapely`, `rasterio`, `sqlalchemy`, `asyncpg`, `geoalchemy2`.

#### [NEW] `backend/app/main.py`
FastAPI application entry point, including CORS configuration to allow local Next.js connection and router includes.

#### [NEW] Models (`backend/app/models/`)
- `report.py`: SQLAlchemy/GeoAlchemy models for citizen reports (points).
- `grid.py`: Models representing spatial analysis grids.

#### [NEW] Services (`backend/app/services/`)
- `osm_service.py`: Fetch static city infrastructure data (fire stations, police, hospitals).
- `routing_service.py`: Custom Dijkstra's algorithm implementation for point-to-point ETAs.
- `risk_engine.py`: Compute flood risk (elevation + rainfall).
- `coverage_engine.py`: Identify distance to nearest critical facilities.
- `heatmap_engine.py`: Transform point data into density/intensity maps.

#### [NEW] Routes (`backend/app/routes/`)
Endpoints for `/flood`, `/traffic`, `/emergency`, `/reports`, `/heatmap`, and `/insights`.

### 3. Frontend (Next.js App Router)
Next.js will provide a seamless 3D mapping experience using Cesium and a cohesive dashboard designed with `shadcn/ui` components.

#### [NEW] Initializing Next.js
We will run standard `npx create-next-app` initialized with Tailwind CSS and TypeScript.

#### [NEW] `frontend/app/page.tsx`
The primary dashboard layout.
Contains the Sidebar (controls, inputs), Insights Panel (analysis results), and the Main Map View.

#### [NEW] Components (`frontend/components/`)
- **Map Box (`map/`)**:
  - `CesiumViewer.tsx`: The core 3D map component.
  - `HeatmapLayer.tsx`: Overlay points via primitive points or heatmap.js integrated over Cesium.
- **Controls Box (`ui/`)**: 
  - Sliders for rainfall.
  - Toggles for map layers.
- **Insights & Reporting**:
  - `InsightCard.tsx`: Display backend analysis outputs.
  - `ReportModal.tsx`: A map-click triggered form to submit categorized localized reports.

## Verification Plan
### Automated Tests
- Test backend endpoints utilizing FastAPI TestClient to ensure mock JSON/GeoJSON is returned as specified.
- Verify that `coverage_engine.py` logic correctly identifies "UNDER-SERVED" tags.

### Manual Verification
- Start the full stack (PostGIS -> FastAPI -> Next.js).
- Load the frontend and click on the map to submit a "litter" report.
- Verify the point appears instantly as an intensity point through the `/heatmap` endpoint.
- Toggle "Flood Risk" with rainfall > 100 on the slider and verify the map renders high-risk overlay indicators safely.
