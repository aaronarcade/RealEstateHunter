"""Load reviewed listings from Supabase with NDJSON fallback."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import streamlit as st

from compat import secrets_get as _secrets_get
from db_client import SupabaseClient, list_reviewed_listings
from reviewed_types import ReviewedListing
from reviewed_sample_data import SAMPLE_REVIEWED_LISTINGS

REVIEWED_NDJSON = Path(__file__).resolve().parent.parent / 'data' / 'reviewed' / 'listings.ndjson'


@dataclass
class ReviewedLoadResult:
    listings: list[ReviewedListing]
    source: str
    error: Optional[str] = None


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _resolve_supabase_config() -> tuple[Optional[str], Optional[str], Optional[str]]:
    _load_dotenv()
    url = _secrets_get('SUPABASE_URL') or os.environ.get('SUPABASE_URL')
    service_key = _secrets_get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    anon_key = _secrets_get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY')
    return url, service_key, anon_key


def _load_from_ndjson() -> list[ReviewedListing]:
    if not REVIEWED_NDJSON.exists():
        return []

    listings: list[ReviewedListing] = []
    for line in REVIEWED_NDJSON.read_text().splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        row = json.loads(trimmed)
        listings.append(
            ReviewedListing(
                id=row['id'],
                address=row['address'],
                city=row['city'],
                country=row['country'],
                region=row.get('region'),
                listing_url=row['listing_url'],
                asking_price=float(row['asking_price']),
                estimated_cap_rate=row.get('estimated_cap_rate'),
                rough_gross_yield=row.get('rough_gross_yield'),
                estimated_monthly_rent=row.get('estimated_monthly_rent'),
                hoa_monthly=row.get('hoa_monthly'),
                sqft=row.get('sqft'),
                beds=row.get('beds'),
                baths=row.get('baths'),
                property_type=row.get('property_type'),
                market_id=row.get('market_id'),
                scout_decision=row['scout_decision'],
                notes=row.get('notes'),
                reviewed_at=row['reviewed_at'],
            )
        )
    return listings


def load_reviewed_listings(*, use_sample_data: bool = False) -> ReviewedLoadResult:
    if use_sample_data:
        return ReviewedLoadResult(listings=list(SAMPLE_REVIEWED_LISTINGS), source='sample')

    url, service_key, anon_key = _resolve_supabase_config()
    if url and (service_key or anon_key):
        try:
            client = SupabaseClient(url=url, service_role_key=service_key, anon_key=anon_key)
            rows = list_reviewed_listings(client)
            if rows:
                return ReviewedLoadResult(listings=rows, source='supabase')
        except Exception as exc:
            ndjson_rows = _load_from_ndjson()
            if ndjson_rows:
                return ReviewedLoadResult(
                    listings=ndjson_rows,
                    source='ndjson',
                    error=f'Supabase unavailable — loaded Git NDJSON. ({exc})',
                )
            return ReviewedLoadResult(
                listings=list(SAMPLE_REVIEWED_LISTINGS),
                source='sample',
                error=f'Failed to load reviewed listings — showing sample data. ({exc})',
            )

    ndjson_rows = _load_from_ndjson()
    if ndjson_rows:
        return ReviewedLoadResult(
            listings=ndjson_rows,
            source='ndjson',
            error='Supabase credentials not configured — loaded Git NDJSON.',
        )

    return ReviewedLoadResult(
        listings=list(SAMPLE_REVIEWED_LISTINGS),
        source='sample',
        error='No Supabase credentials or NDJSON file — showing sample data.',
    )
