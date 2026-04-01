from fastapi import APIRouter
from typing import List
from ..models.grid import GridPoint
from ..services.heatmap_engine import get_layer
from .reports import MOCK_REPORTS

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("/{layer_id}", response_model=List[GridPoint])
def get_heatmap_layer(layer_id: str):
    """
    Returns heatmap intensity points for a given layer.
    Supported: crime, crime_ncrb, garbage_dump, traffic, pothole, drainage,
               stp, street_dogs, crashes
    """
    category_map = {
        "garbage_dump": "garbage_dump",
        "pothole": "pothole",
        "drainage": "drainage",
    }
    extra = []
    if layer_id in category_map:
        cat = category_map[layer_id]
        extra = [{"lat": r.lat, "lng": r.lng} for r in MOCK_REPORTS if r.category == cat]

    points = get_layer(layer_id, extra_points=extra)
    return [GridPoint(lat=p["lat"], lng=p["lng"], intensity=p["intensity"]) for p in points]
