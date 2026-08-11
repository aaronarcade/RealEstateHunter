"""Load market research listings from Supabase with scrape JSON fallback."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import streamlit as st

from compat import secrets_get as _secrets_get
from db_client import SupabaseClient, list_market_listings
from market_types import MarketListing

DEFAULT_SCRAPE = (
    Path(__file__).resolve().parent.parent
    / 'data/scrapes/celebration-kissimmee-poinciana-fl-active-listings-2026-08-10.json'
)

MARKET_ID_BY_AREA = {
    'celebration': 'celebration-fl',
    'kissimmee': 'kissimmee-fl',
    'poinciana': 'poinciana-fl',
}


@dataclass
class MarketLoadResult:
    listings: list[MarketListing]
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


def _slugify(value: str) -> str:
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', value.lower())).strip('-')[:120]


def _listing_id(raw: dict) -> str:
    mls_id = raw.get('mls_id')
    if mls_id:
        return _slugify(f"{mls_id}-{raw.get('state', 'FL')}-{raw.get('zip', '00000')}")
    return _slugify(f"{raw.get('address', '')}-{raw.get('city', '')}-{raw.get('zip', '')}")


def _raw_to_market(raw: dict, scrape_batch: str, scraped_at: str, source: str) -> MarketListing:
    area = raw.get('market_area') or 'other'
    return MarketListing(
        id=_listing_id(raw),
        address=raw.get('address') or 'Unknown address',
        city=raw.get('city') or 'Unknown',
        state=raw.get('state') or 'FL',
        zip=raw.get('zip'),
        market_area=area,
        market_id=MARKET_ID_BY_AREA.get(area),
        asking_price=raw.get('asking_price'),
        beds=raw.get('beds'),
        baths=raw.get('baths'),
        sqft=raw.get('sqft'),
        hoa_monthly=raw.get('hoa_monthly'),
        property_type=raw.get('property_type'),
        year_built=raw.get('year_built'),
        days_on_market=raw.get('days_on_market'),
        mls_id=raw.get('mls_id'),
        listing_url=raw['listing_url'],
        lat=raw.get('lat'),
        lng=raw.get('lng'),
        source=source,
        scrape_batch=scrape_batch,
        scraped_at=scraped_at,
    )


def _load_from_scrape(path: Path = DEFAULT_SCRAPE) -> list[MarketListing]:
    if not path.exists():
        return []

    payload = json.loads(path.read_text())
    scrape_batch = payload.get('scrape_batch') or path.stem.replace('-active-listings', '')
    scraped_at = payload.get('scraped_at') or ''
    source = payload.get('source') or 'redfin'

    by_id: dict[str, MarketListing] = {}
    for raw in payload.get('listings', []):
        if not raw.get('listing_url'):
            continue
        if (raw.get('state') or 'FL') != 'FL':
            continue
        listing = _raw_to_market(raw, scrape_batch, scraped_at, source)
        by_id[listing.id] = listing
    return list(by_id.values())


@st.cache_data(show_spinner=False)
def load_market_listings(use_sample_data: bool = False) -> MarketLoadResult:
    if use_sample_data:
        listings = _load_from_scrape()
        if listings:
            return MarketLoadResult(listings=listings, source='scrape')
        return MarketLoadResult(listings=[], source='empty', error='No local scrape file found.')

    url, service_key, anon_key = _resolve_supabase_config()
    if url and (service_key or anon_key):
        try:
            client = SupabaseClient(url=url, service_role_key=service_key, anon_key=anon_key)
            listings = list_market_listings(client)
            if listings:
                return MarketLoadResult(listings=listings, source='supabase')
        except Exception as exc:
            fallback = _load_from_scrape()
            if fallback:
                return MarketLoadResult(
                    listings=fallback,
                    source='scrape',
                    error=f'Supabase unavailable ({exc}); showing local scrape file.',
                )
            return MarketLoadResult(listings=[], source='error', error=str(exc))

    fallback = _load_from_scrape()
    if fallback:
        return MarketLoadResult(
            listings=fallback,
            source='scrape',
            error='Supabase not configured; showing local scrape file.',
        )

    return MarketLoadResult(
        listings=[],
        source='empty',
        error='Configure Supabase or add a scrape file under data/scrapes/.',
    )
