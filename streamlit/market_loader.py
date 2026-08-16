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
from db_client import (
    SupabaseClient,
    count_market_listings,
    list_market_filter_facets,
    list_market_listings,
    list_opportunities,
    list_reviewed_listings,
)
from db_client.types import PropertyOpportunity
from market_enrichment import CapRateIndex, build_cap_rate_index
from market_types import ListMarketOptions, MarketFilterFacets, MarketListing
from reviewed_loader import load_reviewed_listings
from reviewed_types import ReviewedListing

SCRAPES_DIR = Path(__file__).resolve().parent.parent / 'data/scrapes'

MARKET_ID_BY_AREA = {
    'celebration': 'celebration-fl',
    'kissimmee': 'kissimmee-fl',
    'poinciana': 'poinciana-fl',
    'panama-city-beach': 'panama-city-beach-fl',
    'fort-walton-beach': 'fort-walton-beach-fl',
    'merida-centro': 'merida-centro-mx',
    'cuenca': 'cuenca-ecuador',
    'st-augustine': 'st-augustine-fl',
    'tampa': 'tampa-fl',
    'jacksonville': 'jacksonville-fl',
    'birmingham': 'birmingham-al',
    'memphis': 'memphis-tn',
    'cleveland': 'cleveland-oh',
}


@dataclass
class MarketLoadResult:
    listings: list[MarketListing]
    source: str
    error: Optional[str] = None
    total_count: Optional[int] = None


@dataclass
class MarketFacetsResult:
    facets: MarketFilterFacets
    source: str
    error: Optional[str] = None
    total_count: Optional[int] = None


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


def _load_from_scrape_file(path: Path, by_id: dict[str, MarketListing]) -> None:
    if not path.exists():
        return

    payload = json.loads(path.read_text())
    scrape_batch = payload.get('scrape_batch') or path.stem.replace('-active-listings', '')
    scraped_at = payload.get('scraped_at') or ''
    source = payload.get('source') or 'redfin'

    for raw in payload.get('listings', []):
        if not raw.get('listing_url'):
            continue
        listing = _raw_to_market(raw, scrape_batch, scraped_at, source)
        by_id[listing.id] = listing


def _load_from_scrapes() -> list[MarketListing]:
    by_id: dict[str, MarketListing] = {}
    if not SCRAPES_DIR.exists():
        return []

    for path in sorted(SCRAPES_DIR.glob('*-active-listings*.json')):
        _load_from_scrape_file(path, by_id)
    return list(by_id.values())


def _facets_from_listings(listings: list[MarketListing]) -> MarketFilterFacets:
    areas = sorted({item.market_area for item in listings if item.market_area})
    property_types = sorted({item.property_type for item in listings if item.property_type})
    city_rows = [
        (item.market_area, item.city)
        for item in listings
        if item.market_area and item.city
    ]
    return MarketFilterFacets(
        areas=areas,
        property_types=property_types,
        city_rows=city_rows,
    )


def _resolve_client() -> SupabaseClient | None:
    url, service_key, anon_key = _resolve_supabase_config()
    if url and (service_key or anon_key):
        return SupabaseClient(url=url, service_role_key=service_key, anon_key=anon_key)
    return None


def _filter_options(options: ListMarketOptions | None) -> ListMarketOptions:
    return options or ListMarketOptions()


@st.cache_data(show_spinner=False)
def load_market_filter_facets(use_sample_data: bool = False) -> MarketFacetsResult:
    if use_sample_data:
        listings = _load_from_scrapes()
        if listings:
            return MarketFacetsResult(
                facets=_facets_from_listings(listings),
                source='scrape',
                total_count=len(listings),
            )
        return MarketFacetsResult(
            facets=MarketFilterFacets(areas=[], property_types=[], city_rows=[]),
            source='empty',
            error='No local scrape files found.',
        )

    client = _resolve_client()
    if client:
        try:
            facets = list_market_filter_facets(client)
            total_count = count_market_listings(client)
            if facets.areas or facets.property_types or facets.city_rows:
                return MarketFacetsResult(
                    facets=facets,
                    source='supabase',
                    total_count=total_count,
                )
        except Exception as exc:
            fallback = _load_from_scrapes()
            if fallback:
                return MarketFacetsResult(
                    facets=_facets_from_listings(fallback),
                    source='scrape',
                    error=f'Supabase unavailable ({exc}); using local scrape files.',
                    total_count=len(fallback),
                )
            return MarketFacetsResult(
                facets=MarketFilterFacets(areas=[], property_types=[], city_rows=[]),
                source='error',
                error=str(exc),
            )

    fallback = _load_from_scrapes()
    if fallback:
        return MarketFacetsResult(
            facets=_facets_from_listings(fallback),
            source='scrape',
            error='Supabase not configured; using local scrape files.',
            total_count=len(fallback),
        )

    return MarketFacetsResult(
        facets=MarketFilterFacets(areas=[], property_types=[], city_rows=[]),
        source='empty',
        error='Configure Supabase or add a scrape file under data/scrapes/.',
    )


@st.cache_data(show_spinner=False)
def load_market_listings(
    use_sample_data: bool = False,
    market_area: str = 'All',
    city: str = 'All',
    property_type: str = 'All',
    min_price: float | None = None,
    max_price: float | None = None,
) -> MarketLoadResult:
    options = ListMarketOptions(
        market_area=market_area if market_area != 'All' else None,
        city=city if city != 'All' else None,
        property_type=property_type if property_type != 'All' else None,
        min_price=min_price,
        max_price=max_price,
    )

    if use_sample_data:
        listings = _load_from_scrapes()
        if listings:
            from market_filters import apply_market_filters

            filtered = apply_market_filters(
                listings,
                market_area=market_area,
                city=city,
                property_type=property_type,
                min_price=min_price,
                max_price=max_price,
            )
            return MarketLoadResult(
                listings=filtered,
                source='scrape',
                total_count=len(listings),
            )
        return MarketLoadResult(listings=[], source='empty', error='No local scrape files found.')

    client = _resolve_client()
    if client:
        try:
            listings = list_market_listings(client, options)
            total_count = count_market_listings(client)
            if listings or total_count:
                return MarketLoadResult(
                    listings=listings,
                    source='supabase',
                    total_count=total_count,
                )
        except Exception as exc:
            fallback = _load_from_scrapes()
            if fallback:
                from market_filters import apply_market_filters

                filtered = apply_market_filters(
                    fallback,
                    market_area=market_area,
                    city=city,
                    property_type=property_type,
                    min_price=min_price,
                    max_price=max_price,
                )
                return MarketLoadResult(
                    listings=filtered,
                    source='scrape',
                    error=f'Supabase unavailable ({exc}); showing local scrape files.',
                    total_count=len(fallback),
                )
            return MarketLoadResult(listings=[], source='error', error=str(exc))

    fallback = _load_from_scrapes()
    if fallback:
        from market_filters import apply_market_filters

        filtered = apply_market_filters(
            fallback,
            market_area=market_area,
            city=city,
            property_type=property_type,
            min_price=min_price,
            max_price=max_price,
        )
        return MarketLoadResult(
            listings=filtered,
            source='scrape',
            error='Supabase not configured; showing local scrape files.',
            total_count=len(fallback),
        )

    return MarketLoadResult(
        listings=[],
        source='empty',
        error='Configure Supabase or add a scrape file under data/scrapes/.',
    )


def _fetch_pipeline_properties(client: SupabaseClient) -> list[PropertyOpportunity]:
    try:
        return list_opportunities(client)
    except Exception:
        return []


def _fetch_reviewed_for_enrichment(client: SupabaseClient | None) -> list[ReviewedListing]:
    if client:
        try:
            rows = list_reviewed_listings(client)
            if rows:
                return rows
        except Exception:
            pass
    result = load_reviewed_listings()
    return result.listings


@st.cache_data(show_spinner=False)
def load_cap_rate_index() -> CapRateIndex:
    client = _resolve_client()
    reviewed = _fetch_reviewed_for_enrichment(client)
    properties: list[PropertyOpportunity] = []
    if client:
        properties = _fetch_pipeline_properties(client)
    return build_cap_rate_index(reviewed, properties)
