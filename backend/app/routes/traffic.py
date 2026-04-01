from fastapi import APIRouter
from ..services.routing_service import compute_route

router = APIRouter(prefix="/traffic", tags=["traffic"])

@router.get("/route")
def get_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    """
    Compute a route using the custom Dijkstra's algorithm.
    Returns ETA, distance, delay, status and a list of path coordinates.
    """
    return compute_route(start_lat, start_lng, end_lat, end_lng)
