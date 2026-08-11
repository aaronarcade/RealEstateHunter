"""Cap rate enrichment and city baseline comparison for market listings."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal, Optional

from db_client.types import PropertyOpportunity
from market_analytics import GROSS_YIELD_TARGET, _median, _price_per_sqft
from market_types import MarketListing
from reviewed_types import ReviewedListing

CapRateSource = Literal['VERIFIED_PROPERTY', 'VERIFIED_REVIEWED', 'ESTIMATED']


@dataclass
class CapRateMatch:
    cap_rate: float
    source: CapRateSource
    noi: Optional[float] = None
    monthly_rent: Optional[float] = None
    match_key: Optional[str] = None


@dataclass
class EnrichedMarketListing:
    listing: MarketListing
    cap_rate: Optional[float] = None
    cap_rate_source: Optional[CapRateSource] = None
    noi_annual: Optional[float] = None
    noi_per_sqft: Optional[float] = None
    price_vs_city_median_pct: Optional[float] = None
    sqft_price_vs_city_median_pct: Optional[float] = None
    cap_rate_vs_city_median_bps: Optional[float] = None
    noi_per_sqft_vs_city_median_pct: Optional[float] = None
    map_color: Optional[str] = None


@dataclass
class CityBaseline:
    city: str
    count: int
    median_price: Optional[float] = None
    median_price_per_sqft: Optional[float] = None
    median_hoa: Optional[float] = None
    median_cap_rate: Optional[float] = None
    median_noi_per_sqft: Optional[float] = None
    cap_rate_sample_size: int = 0


@dataclass
class CapRateIndex:
    by_url: dict[str, CapRateMatch]
    by_mls_id: dict[str, CapRateMatch]
    by_address_city: dict[str, CapRateMatch]


def _slugify(value: str) -> str:
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', value.lower())).strip('-')[:120]


def _normalize_street(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r'\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct)\b', '', text)
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def address_city_key(address: str, city: str) -> str:
    return _slugify(f'{_normalize_street(address)}-{city.lower().strip()}')


def noi_per_sqft_from_cap(cap_rate: float, price: float, sqft: float) -> float:
    """Annual NOI per sqft derived from cap rate and asking price."""
    if sqft <= 0:
        return 0.0
    return (cap_rate * price) / sqft


def noi_per_sqft_from_noi(noi: float, sqft: float) -> float:
    if sqft <= 0:
        return 0.0
    return noi / sqft


def estimate_cap_rate_proxy(listing: MarketListing) -> Optional[CapRateMatch]:
    """
    Scout-style proxy: assume gross rent at 10% yield target, subtract known HOA.
    Labeled ESTIMATED — not verified pipeline data.
    """
    if listing.asking_price is None or listing.asking_price <= 0:
        return None
    hoa_annual = (listing.hoa_monthly or 0) * 12
    gross_rent = listing.asking_price * GROSS_YIELD_TARGET
    noi = gross_rent - hoa_annual
    cap_rate = noi / listing.asking_price
    return CapRateMatch(
        cap_rate=cap_rate,
        source='ESTIMATED',
        noi=noi,
        monthly_rent=gross_rent / 12,
        match_key='proxy_gross_yield',
    )


def _pick_better(existing: CapRateMatch | None, candidate: CapRateMatch) -> CapRateMatch:
    if existing is None:
        return candidate
    priority = {'VERIFIED_PROPERTY': 3, 'VERIFIED_REVIEWED': 2, 'ESTIMATED': 1}
    if priority[candidate.source] > priority[existing.source]:
        return candidate
    return existing


def build_cap_rate_index(
    reviewed: list[ReviewedListing],
    properties: list[PropertyOpportunity],
) -> CapRateIndex:
    by_url: dict[str, CapRateMatch] = {}
    by_mls_id: dict[str, CapRateMatch] = {}
    by_address_city: dict[str, CapRateMatch] = {}

    for item in reviewed:
        if item.estimated_cap_rate is None:
            continue
        match = CapRateMatch(
            cap_rate=item.estimated_cap_rate,
            source='VERIFIED_REVIEWED',
            monthly_rent=item.estimated_monthly_rent,
            match_key=item.id,
        )
        if item.listing_url:
            by_url[item.listing_url.rstrip('/')] = _pick_better(
                by_url.get(item.listing_url.rstrip('/')), match
            )
        key = address_city_key(item.address, item.city)
        by_address_city[key] = _pick_better(by_address_city.get(key), match)

    for item in properties:
        if item.cap_rate is None:
            continue
        match = CapRateMatch(
            cap_rate=item.cap_rate,
            source='VERIFIED_PROPERTY',
            noi=item.noi,
            monthly_rent=item.monthly_rent.value if item.monthly_rent else None,
            match_key=item.id,
        )
        if item.listing_url:
            by_url[item.listing_url.rstrip('/')] = _pick_better(
                by_url.get(item.listing_url.rstrip('/')), match
            )
        location_parts = (item.location or '').split(',')
        city = location_parts[0].strip() if location_parts else item.location or ''
        key = address_city_key(item.address, city)
        by_address_city[key] = _pick_better(by_address_city.get(key), match)

    return CapRateIndex(by_url=by_url, by_mls_id=by_mls_id, by_address_city=by_address_city)


def lookup_cap_rate(listing: MarketListing, index: CapRateIndex) -> Optional[CapRateMatch]:
    if listing.listing_url:
        url_key = listing.listing_url.rstrip('/')
        if url_key in index.by_url:
            return index.by_url[url_key]

    if listing.mls_id:
        mls_key = _slugify(str(listing.mls_id))
        if mls_key in index.by_mls_id:
            return index.by_mls_id[mls_key]

    key = address_city_key(listing.address, listing.city)
    if key in index.by_address_city:
        return index.by_address_city[key]

    return None


def resolve_cap_rate(listing: MarketListing, index: CapRateIndex) -> Optional[CapRateMatch]:
    matched = lookup_cap_rate(listing, index)
    if matched is not None:
        return matched
    return estimate_cap_rate_proxy(listing)


def compute_noi_per_sqft(
    cap_rate: Optional[float],
    price: Optional[float],
    sqft: Optional[float],
    noi: Optional[float] = None,
) -> Optional[float]:
    if sqft is None or sqft <= 0:
        return None
    if noi is not None:
        return noi_per_sqft_from_noi(noi, sqft)
    if cap_rate is not None and price is not None:
        return noi_per_sqft_from_cap(cap_rate, price, sqft)
    return None


def compute_city_baselines(enriched: list[EnrichedMarketListing]) -> dict[str, CityBaseline]:
    by_city: dict[str, list[EnrichedMarketListing]] = {}
    for item in enriched:
        city = item.listing.city.strip().lower() if item.listing.city else 'unknown'
        by_city.setdefault(city, []).append(item)

    baselines: dict[str, CityBaseline] = {}
    for city, items in by_city.items():
        listings = [entry.listing for entry in items]
        prices = [row.asking_price for row in listings if row.asking_price is not None]
        ppsf = [_price_per_sqft(row) for row in listings]
        ppsf = [value for value in ppsf if value is not None]
        hoas = [row.hoa_monthly for row in listings if row.hoa_monthly is not None]
        cap_rates = [entry.cap_rate for entry in items if entry.cap_rate is not None]
        noi_sqft = [entry.noi_per_sqft for entry in items if entry.noi_per_sqft is not None]

        display_city = items[0].listing.city if items else city
        baselines[city] = CityBaseline(
            city=display_city,
            count=len(items),
            median_price=_median([float(value) for value in prices]),
            median_price_per_sqft=_median(ppsf),
            median_hoa=_median([float(value) for value in hoas]),
            median_cap_rate=_median(cap_rates),
            median_noi_per_sqft=_median(noi_sqft),
            cap_rate_sample_size=len(cap_rates),
        )
    return baselines


def _pct_delta(value: Optional[float], baseline: Optional[float]) -> Optional[float]:
    if value is None or baseline is None or baseline == 0:
        return None
    return round(100.0 * (value - baseline) / baseline, 1)


def _bps_delta(value: Optional[float], baseline: Optional[float]) -> Optional[float]:
    if value is None or baseline is None:
        return None
    return round((value - baseline) * 10_000, 0)


def baseline_map_color(
    cap_rate_bps: Optional[float],
    ppsf_pct: Optional[float],
) -> str:
    """Green = above city cap median or below city $/sqft median; red = opposite."""
    if cap_rate_bps is not None:
        if cap_rate_bps >= 50:
            return '#059669'
        if cap_rate_bps <= -50:
            return '#dc2626'
        return '#d97706'
    if ppsf_pct is not None:
        if ppsf_pct <= -5:
            return '#059669'
        if ppsf_pct >= 5:
            return '#dc2626'
        return '#d97706'
    return '#94a3b8'


def apply_city_baselines(
    enriched: list[EnrichedMarketListing],
    baselines: dict[str, CityBaseline],
) -> list[EnrichedMarketListing]:
    for item in enriched:
        city_key = item.listing.city.strip().lower() if item.listing.city else 'unknown'
        baseline = baselines.get(city_key)
        if baseline is None:
            continue

        price = item.listing.asking_price
        ppsf = _price_per_sqft(item.listing)

        item.price_vs_city_median_pct = _pct_delta(
            float(price) if price is not None else None,
            baseline.median_price,
        )
        item.sqft_price_vs_city_median_pct = _pct_delta(ppsf, baseline.median_price_per_sqft)
        item.cap_rate_vs_city_median_bps = _bps_delta(item.cap_rate, baseline.median_cap_rate)
        item.noi_per_sqft_vs_city_median_pct = _pct_delta(
            item.noi_per_sqft,
            baseline.median_noi_per_sqft,
        )
        item.map_color = baseline_map_color(
            item.cap_rate_vs_city_median_bps,
            item.sqft_price_vs_city_median_pct,
        )
    return enriched


def enrich_market_listings(
    listings: list[MarketListing],
    index: CapRateIndex,
) -> list[EnrichedMarketListing]:
    enriched: list[EnrichedMarketListing] = []
    for listing in listings:
        cap_match = resolve_cap_rate(listing, index)
        cap_rate = cap_match.cap_rate if cap_match else None
        cap_source = cap_match.source if cap_match else None
        noi = cap_match.noi if cap_match else None
        if noi is None and cap_rate is not None and listing.asking_price is not None:
            noi = cap_rate * listing.asking_price

        noi_sqft = compute_noi_per_sqft(
            cap_rate,
            listing.asking_price,
            listing.sqft,
            noi=noi,
        )
        enriched.append(
            EnrichedMarketListing(
                listing=listing,
                cap_rate=cap_rate,
                cap_rate_source=cap_source,
                noi_annual=noi,
                noi_per_sqft=noi_sqft,
            )
        )

    baselines = compute_city_baselines(enriched)
    return apply_city_baselines(enriched, baselines)


def city_baselines_to_rows(baselines: dict[str, CityBaseline]) -> list[dict]:
    rows = []
    for baseline in sorted(baselines.values(), key=lambda item: item.city.lower()):
        rows.append(
            {
                'City': baseline.city,
                'Listings': baseline.count,
                'Median price': baseline.median_price,
                'Median $/sqft': baseline.median_price_per_sqft,
                'Median HOA': baseline.median_hoa,
                'Median cap rate': baseline.median_cap_rate,
                'Cap rate samples': baseline.cap_rate_sample_size,
                'Median NOI/sqft': baseline.median_noi_per_sqft,
            }
        )
    return rows


def deals_vs_baseline_counts(enriched: list[EnrichedMarketListing]) -> dict[str, int]:
    below_median_ppsf = 0
    above_median_cap = 0
    above_median_noi_sqft = 0
    for item in enriched:
        if item.sqft_price_vs_city_median_pct is not None and item.sqft_price_vs_city_median_pct < 0:
            below_median_ppsf += 1
        if item.cap_rate_vs_city_median_bps is not None and item.cap_rate_vs_city_median_bps > 0:
            above_median_cap += 1
        if (
            item.noi_per_sqft_vs_city_median_pct is not None
            and item.noi_per_sqft_vs_city_median_pct > 0
        ):
            above_median_noi_sqft += 1
    return {
        'below_median_ppsf': below_median_ppsf,
        'above_median_cap_rate': above_median_cap,
        'above_median_noi_sqft': above_median_noi_sqft,
    }
