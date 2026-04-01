# Smart City Intelligence System - Project Context

## Goal
To build a FULL-STACK smart city intelligence system serving as a decision-support dashboard for Indian cities. The system aims to simulate urban scenarios, detect infrastructure weaknesses, show heatmaps, and provide actionable insights.

## Architecture

*   **Frontend**: Next.js (App Router), TypeScript, TailwindCSS, shadcn/ui.
*   **3D Map**: CesiumJS for rendering 3D maps and interactive layers.
*   **Backend**: FastAPI (Python) for analysis and serving APIs.
*   **Database**: Since Docker is not available on your machine, we are designing the backend to use an **in-memory or simplified SQLite** database structure for MVP development instead of PostgreSQL/PostGIS. We will compute geographic relationships (distances, Dijkstra routines) locally in Python.

## Core Features
1.  **Flood Simulation**: Uses OpenWeather API to predict flood risk based on simulated or real rainfall combined with hardcoded/mocked elevation data.
2.  **Traffic Analysis**: Originally intended for OSRM, we are implementing a **custom Dijkstra's algorithm** in the backend to calculate distances, ETAs, and traffic congestion points.
3.  **Emergency Response**: Computes ETA and coverage zones for police, fire stations, and hospitals.
4.  **Citizen Reporting**: A feature letting users drop pins for potholes, drainage, or litter, feeding directly into the Heatmap system.
5.  **Heatmaps & Insights Panel**: Visualizes crime and litter densities. A rules engine synthesizes all data to generate the "CITY WEAKNESS REPORT", highlighting the top 5 areas with infrastructure gaps.
