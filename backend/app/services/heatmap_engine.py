"""
heatmap_engine.py — Transform point data into density/intensity maps.
Supports crime, garbage_dump, traffic, pothole, drainage, crime_ncrb,
stp, street_dogs, and crashes layers.
"""
import csv
import math
import random
from pathlib import Path
from typing import List, Dict, Any

# Path to datasets directory
_DATASETS = Path(__file__).parent.parent.parent.parent / "datasets"

_CRIME_CSV    = _DATASETS / "bengaluru_crime_data.csv"
_TRAFFIC_CSV  = _DATASETS / "bengaluru_traffic_data.csv"
_GARBAGE_CSV  = _DATASETS / "garbage_dump_banglore.csv"
_STP_CSV      = _DATASETS / "stp.csv.csv"
_DOGS_CSV     = _DATASETS / "street_dogs_banglore.csv"
_CRASHES_CSV  = _DATASETS / "btp_2025_station_wise.csv"

# BBMP zone → approximate centroid coordinates
_ZONE_COORDS: Dict[str, tuple] = {
    "East":         (12.9719, 77.6412),
    "West":         (12.9784, 77.5459),
    "South":        (12.9165, 77.6015),
    "Dasarahalli":  (13.0467, 77.5240),
    "RR Nagar":     (12.9234, 77.5066),
    "Bommanahalli": (12.8785, 77.6252),
    "Yalahanka":    (13.1006, 77.5963),
    "Mahadevapura": (12.9929, 77.6936),
}

# BTP station name → approximate coordinates
_STATION_COORDS: Dict[str, tuple] = {
    "Halasooru":              (12.9763, 77.6154),
    "Indiranagar":            (12.9719, 77.6412),
    "Pulikeshinagar":         (12.9780, 77.5931),
    "Banasawadi":             (12.9951, 77.6368),
    "Shivajinagar":           (12.9848, 77.5960),
    "K G Halli":              (12.9890, 77.6213),
    "K R Puram":              (13.0059, 77.6934),
    "Airport":                (13.2066, 77.7106),
    "Whitefield":             (12.9698, 77.7499),
    "Mahadevapura":           (12.9929, 77.6936),
    "Cubbon Park":            (12.9762, 77.5983),
    "H.Grounds":              (12.9785, 77.5871),
    "S.S.Nagar":              (12.9566, 77.5706),
    "U.Gate":                 (12.9779, 77.5677),
    "Ashokanagar":            (12.9977, 77.5679),
    "W.Garden":               (12.9784, 77.5706),
    "Upparpet":               (12.9765, 77.5721),
    "Sheshadripuram/Chickpet":(12.9890, 77.5742),
    "City Market":            (12.9643, 77.5731),
    "Bytarayanapura":         (13.0437, 77.5694),
    "Kengeri":                (12.9190, 77.4836),
    "Chamarajpet":            (12.9618, 77.5621),
    "Jnanabharathi":          (12.9370, 77.5122),
    "Vijayanagar":            (12.9665, 77.5316),
    "Magadi Road":            (12.9600, 77.5253),
    "Kamakshipalya":          (12.9792, 77.5325),
    "R T Nagar":              (13.0127, 77.5946),
    "Hebbala":                (13.0270, 77.5985),
    "Yalahanka":              (13.1006, 77.5963),
    "Chikkajala":             (13.1703, 77.6100),
    "Int. Aiport":            (13.2066, 77.7106),
    "Hennuru":                (13.0357, 77.6423),
    "Malleshwaram":           (12.9966, 77.5696),
    "Rajajinagar":            (12.9921, 77.5535),
    "Yashawanthapura":        (13.0269, 77.5412),
    "Peenya":                 (13.0291, 77.5194),
    "Jalahalli":              (13.0400, 77.5383),
    "Chikkabanavara":         (13.0780, 77.5000),
    "Kodigehalli":            (13.0618, 77.5815),
    "Adugodi":                (12.9349, 77.6154),
    "Madivala":               (12.9201, 77.6246),
    "Micolayout":             (12.9057, 77.6236),
    "Hulimavu":               (12.8909, 77.6101),
    "VV Puram":               (12.9491, 77.5716),
    "Basavanagudi":           (12.9406, 77.5739),
    "Jayanagar":              (12.9285, 77.5813),
    "Banashankari":           (12.9213, 77.5466),
    "K S Layout":             (12.9283, 77.5620),
    "Thalagattapura":         (12.8521, 77.5170),
    "JP Nagar":               (12.9063, 77.5853),
    "HSR Layout":             (12.9116, 77.6426),
    "Electronic City":        (12.8393, 77.6768),
    "Bellanduru":             (12.9280, 77.6852),
}


def _load_crime_csv() -> List[Dict]:
    """Load crime heatmap points from bengaluru_crime_data.csv."""
    points = []
    try:
        with open(_CRIME_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    points.append({
                        "lat": float(row["Latitude"]),
                        "lng": float(row["Longitude"]),
                        "intensity": round(min(1.0, float(row["Severity_Rating"]) / 10.0), 3),
                    })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return points


def _load_traffic_csv() -> List[Dict]:
    """Load traffic heatmap points from bengaluru_traffic_data.csv."""
    points = []
    try:
        with open(_TRAFFIC_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    points.append({
                        "lat": float(row["latitude"]),
                        "lng": float(row["longitude"]),
                        "intensity": round(min(1.0, float(row["traffic_volume"]) / 1000.0), 3),
                        "area": row.get("area_name", ""),
                        "congestion": row.get("congestion_level", ""),
                        "speed": row.get("avg_speed_kmph", ""),
                    })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return points


def _load_garbage_csv() -> List[Dict]:
    """Load real garbage dump locations from garbage_dump_banglore.csv."""
    points = []
    try:
        with open(_GARBAGE_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    lat = float(row["Latitude"])
                    lng = float(row["Longitude"])
                    # Use observations to hint severity; default intensity 0.7
                    obs = row.get("Observations", "").lower()
                    intensity = 0.9 if "never" in obs else 0.6 if "cleared" in obs else 0.7
                    points.append({
                        "lat": lat,
                        "lng": lng,
                        "intensity": intensity,
                        "ward": row.get("Ward name/number", ""),
                        "observations": row.get("Observations", ""),
                    })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return points


def _load_stp_csv() -> List[Dict]:
    """Load sewage treatment plant locations from stp.csv.csv."""
    points = []
    try:
        with open(_STP_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    cap_str = row.get("TreatmentCapacity (KLD)", "0").strip()
                    capacity = float(cap_str) if cap_str else 0.0
                    max_cap = 120000.0
                    intensity = round(min(1.0, capacity / max_cap), 3)
                    points.append({
                        "lat": float(row["Latitude"]),
                        "lng": float(row["Longitude"]),
                        "intensity": max(0.3, intensity),
                        "name": row.get("STPName", "").strip(),
                        "capacity_kld": capacity,
                        "plant_type": row.get("PlantType", "").strip(),
                    })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return points


def _load_street_dogs() -> List[Dict]:
    """Load street dog density from zone data, mapped to coordinates."""
    points = []
    rng = random.Random(303)
    try:
        with open(_DOGS_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            max_density = 800.0
            for row in reader:
                zone = row.get("BBMP Zone", "").strip()
                if zone == "TOTAL" or zone not in _ZONE_COORDS:
                    continue
                try:
                    density = float(row.get("Dogs per sq. km", "0").replace(",", ""))
                    population = int(row.get("Population", "0").replace(",", ""))
                    intensity = round(min(1.0, density / max_density), 3)
                    lat, lng = _ZONE_COORDS[zone]
                    # Scatter proportional to population — enough points for a visible heatmap
                    scatter_count = max(40, population // 700)
                    for _ in range(scatter_count):
                        points.append({
                            "lat": round(lat + rng.uniform(-0.03, 0.03), 6),
                            "lng": round(lng + rng.uniform(-0.03, 0.03), 6),
                            "intensity": max(0.2, intensity * rng.uniform(0.65, 1.0)),
                            "zone": zone,
                        })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return points


def _load_btp_crashes() -> List[Dict]:
    """Load road crash data from btp_2025_station_wise.csv, mapped to station coords."""
    points = []
    max_crashes = 270.0  # K R Puram highest at 267
    try:
        with open(_CRASHES_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                station = row.get("Station", "").strip()
                if not station or "Total" in station or "Grand" in station:
                    continue
                coords = _STATION_COORDS.get(station)
                if not coords:
                    continue
                try:
                    total = int(row.get("2025-Total crashes", "0") or "0")
                    fatal = int(row.get("2025-Fatal crashes", "0") or "0")
                    if total == 0:
                        continue
                    intensity = round(min(1.0, total / max_crashes), 3)
                    points.append({
                        "lat": coords[0],
                        "lng": coords[1],
                        "intensity": intensity,
                        "station": station,
                        "total_crashes": total,
                        "fatal_crashes": fatal,
                    })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return points


def _jitter_points(base: List[tuple], count: int = 5, spread: float = 0.015, seed: int = 42) -> List[Dict]:
    rng = random.Random(seed)
    points = []
    for lat, lng, intensity in base:
        points.append({"lat": lat, "lng": lng, "intensity": intensity})
        for _ in range(count):
            points.append({
                "lat": lat + rng.uniform(-spread, spread),
                "lng": lng + rng.uniform(-spread, spread),
                "intensity": max(0.1, intensity * rng.uniform(0.5, 0.95)),
            })
    return points


def _get_ncrb_layer() -> List[Dict]:
    """Convert NCRB 2023 data to heatmap intensity points."""
    from ..data.ncrb_crime_2023 import BANGALORE_ZONE_CRIME, KARNATAKA_CRIME_2023

    rng = random.Random(77)
    points = []

    for zone_name, lat, lng, crime_index in BANGALORE_ZONE_CRIME:
        points.append({"lat": lat, "lng": lng, "intensity": crime_index})
        for _ in range(6):
            points.append({
                "lat": lat + rng.uniform(-0.015, 0.015),
                "lng": lng + rng.uniform(-0.015, 0.015),
                "intensity": max(0.1, crime_index * rng.uniform(0.5, 0.9)),
            })

    MAX_IPC = max(d["ipc_total"] for d in KARNATAKA_CRIME_2023)
    for district in KARNATAKA_CRIME_2023:
        if "Bangalore Urban" in district["district"]:
            continue
        intensity = round(district["ipc_total"] / MAX_IPC, 3)
        points.append({"lat": district["lat"], "lng": district["lng"], "intensity": intensity})

    return points


def get_layer(layer_id: str, extra_points: List[Dict] = None) -> List[Dict]:
    extra_points = extra_points or []

    if layer_id == "crime":
        base = _load_crime_csv()
        if not base:
            base = _get_ncrb_layer()
    elif layer_id == "crime_ncrb":
        base = _get_ncrb_layer()
    elif layer_id == "traffic":
        base = _load_traffic_csv()
        if not base:
            base = _jitter_points([
                (12.9716, 77.5946, 0.95), (12.9784, 77.6408, 0.85),
                (12.9983, 77.5706, 0.70), (13.0354, 77.5967, 0.65),
                (12.9354, 77.6231, 0.80), (12.9600, 77.6100, 0.88),
            ], count=6, spread=0.015, seed=101)
    elif layer_id == "pothole":
        from ..services.data_service import load_potholes
        real = load_potholes()
        base = [{"lat": p["lat"], "lng": p["lng"], "intensity": p["intensity"]} for p in real]
    elif layer_id == "drainage":
        from ..services.data_service import generate_drainage_data
        drains = generate_drainage_data()
        base = [{"lat": d["lat"], "lng": d["lng"], "intensity": d["intensity"]} for d in drains]
    elif layer_id == "garbage_dump":
        base = _load_garbage_csv()
    elif layer_id == "stp":
        base = _load_stp_csv()
    elif layer_id == "street_dogs":
        base = _load_street_dogs()
    elif layer_id == "crashes":
        base = _load_btp_crashes()
    else:
        return []

    for p in extra_points:
        base.append({"lat": p["lat"], "lng": p["lng"], "intensity": 0.9})

    return base
