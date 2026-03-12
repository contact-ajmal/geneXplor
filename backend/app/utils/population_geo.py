"""Geographic metadata for gnomAD population groups.

Maps each gnomAD population ID to human-readable names, representative
geographic regions, center coordinates, and display colors.
"""

from __future__ import annotations

POPULATION_GEO: dict[str, dict] = {
    "afr": {
        "name": "African / African American",
        "regions": ["Western Africa", "Eastern Africa", "Southern Africa"],
        "center_lat": 0,
        "center_lng": 20,
        "color_base": "#ff6b6b",
    },
    "amr": {
        "name": "Latino / Admixed American",
        "regions": ["Central America", "South America", "Caribbean"],
        "center_lat": 0,
        "center_lng": -60,
        "color_base": "#ff8c00",
    },
    "asj": {
        "name": "Ashkenazi Jewish",
        "regions": ["point_marker"],
        "center_lat": 32,
        "center_lng": 35,
        "color_base": "#00d4ff",
    },
    "eas": {
        "name": "East Asian",
        "regions": ["Eastern Asia", "Southeastern Asia"],
        "center_lat": 35,
        "center_lng": 115,
        "color_base": "#ffd93d",
    },
    "fin": {
        "name": "Finnish",
        "regions": ["Finland"],
        "center_lat": 64,
        "center_lng": 26,
        "color_base": "#9b59b6",
    },
    "mid": {
        "name": "Middle Eastern",
        "regions": ["Western Asia", "Northern Africa"],
        "center_lat": 30,
        "center_lng": 45,
        "color_base": "#e74c3c",
    },
    "nfe": {
        "name": "Non-Finnish European",
        "regions": ["Western Europe", "Southern Europe", "Northern Europe"],
        "center_lat": 50,
        "center_lng": 10,
        "color_base": "#6bcb77",
    },
    "sas": {
        "name": "South Asian",
        "regions": ["Southern Asia"],
        "center_lat": 25,
        "center_lng": 78,
        "color_base": "#4d96ff",
    },
    "oth": {
        "name": "Other",
        "regions": [],
        "center_lat": 0,
        "center_lng": 0,
        "color_base": "#64748b",
    },
}

# Standardised population IDs the gnomAD v4 API returns
GNOMAD_POPULATION_IDS: list[str] = list(POPULATION_GEO.keys())
