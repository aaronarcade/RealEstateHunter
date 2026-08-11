"""Approximate coordinates for reviewed listing map plots (city/market centroids)."""

from __future__ import annotations

import hashlib

from reviewed_types import ReviewedListing

# City + country → (latitude, longitude)
CITY_CENTROIDS: dict[tuple[str, str], tuple[float, float]] = {
    ('Panama City Beach', 'United States'): (30.1766, -85.8055),
    ('Celebration', 'United States'): (28.3186, -81.5401),
    ('Manta', 'Ecuador'): (-0.9677, -80.7089),
    ('Cuenca', 'Ecuador'): (-2.9001, -79.0059),
    ('Quito', 'Ecuador'): (-0.1807, -78.4678),
    ('Tampa', 'United States'): (27.9506, -82.4572),
    ('Jacksonville', 'United States'): (30.3322, -81.6557),
}

# market_id fallback when city is Unknown
MARKET_CENTROIDS: dict[str, tuple[float, float]] = {
    'panama-city-beach-fl': (30.1766, -85.8055),
    'celebration-fl': (28.3186, -81.5401),
    'manta-ec': (-0.9677, -80.7089),
    'cuenca-ecuador': (-2.9001, -79.0059),
    'quito-ec': (-0.1807, -78.4678),
}


def _jitter_coordinates(listing_id: str, lat: float, lon: float, scale: float = 0.015) -> tuple[float, float]:
    digest = hashlib.md5(listing_id.encode(), usedforsecurity=False).hexdigest()
    lat_seed = int(digest[:8], 16) / 0xFFFFFFFF - 0.5
    lon_seed = int(digest[8:16], 16) / 0xFFFFFFFF - 0.5
    return lat + lat_seed * scale, lon + lon_seed * scale


def geocode_listing(listing: ReviewedListing) -> tuple[float | None, float | None]:
    key = (listing.city, listing.country)
    centroid = CITY_CENTROIDS.get(key)

    if centroid is None and listing.market_id:
        centroid = MARKET_CENTROIDS.get(listing.market_id)

    if centroid is None:
        return None, None

    return _jitter_coordinates(listing.id, centroid[0], centroid[1])
