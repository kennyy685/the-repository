"""Distance, direction and curve helpers."""
import math

import numpy as np

R_MI = 3958.7613
_COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def haversine_mi(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_MI * math.asin(math.sqrt(min(1.0, a)))


def haversine_np(lat1, lon1, lats, lons):
    lats = np.radians(np.asarray(lats, dtype=float))
    lons = np.radians(np.asarray(lons, dtype=float))
    p1, l1 = math.radians(lat1), math.radians(lon1)
    a = np.sin((lats - p1) / 2) ** 2 + math.cos(p1) * np.cos(lats) * np.sin((lons - l1) / 2) ** 2
    return 2 * R_MI * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def bearing_deg(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def compass(deg):
    return _COMPASS[int((deg + 11.25) // 22.5) % 16]


def bbox_for_radius(lat, lon, radius_mi):
    """(min_lon, min_lat, max_lon, max_lat) covering a circle."""
    dlat = radius_mi / 69.05
    edge_lat = min(89.0, abs(lat) + dlat)
    dlon = radius_mi / (69.17 * math.cos(math.radians(edge_lat)))
    return (round(lon - dlon, 3), round(lat - dlat, 3), round(lon + dlon, 3), round(lat + dlat, 3))


def interp(curve, x):
    """Piecewise-linear lookup on [[x, y], ...], clamped at both ends."""
    if x is None:
        return 0.0
    if x <= curve[0][0]:
        return float(curve[0][1])
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
        if x <= x1:
            return float(y1 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0))
    return float(curve[-1][1])
