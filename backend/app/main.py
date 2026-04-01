from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Smart City Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Smart City Backend is running."}

from .routes import flood, traffic, emergency, heatmap, insights, reports, datasets, kml

app.include_router(flood.router)
app.include_router(traffic.router)
app.include_router(emergency.router)
app.include_router(heatmap.router)
app.include_router(insights.router)
app.include_router(reports.router)
app.include_router(datasets.router)
app.include_router(kml.router)


