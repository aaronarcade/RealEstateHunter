"""Investment-oriented analytics for market research listings."""

from __future__ import annotations

import json
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from market_types import MarketListing

SEARCH_CRITERIA_PATH = (
    Path(__file__).resolve().parent.parent / 'data' / 'search-criteria.json'
)

GROSS_YIELD_TARGET = 0.10
HOA_SCRUTINY_MONTHLY = 500
ADJUSTED_YIELD_FLOOR = 0.08
DEFAULT_PRICE_MIN = 75_000
DEFAULT_PRICE_MAX = 750_000
DEFAULT_BEDS_MIN = 2


@dataclass
class MarketBaseline:
    market_area: str
    count: int
    median_price: Optional[float] = None
    median_price_per_sqft: Optional[float] = None
    median_hoa: Optional[float] = None
    pct_hoa_over_500: Optional[float] = None
    median_dom: Optional[float] = None
    pct_condo: Optional[float] = None
    pct_in_price_range: Optional[float] = None


@dataclass
class InvestmentSignals:
    under_median_price_per_sqft: int = 0
    low_hoa_vs_area: int = 0
    scout_price_range_2br_plus: int = 0
    hoa_over_scrutiny: int = 0
    median_price_per_sqft: Optional[float] = None
    median_hoa: Optional[float] = None


@dataclass
class YieldProxyBand:
    label: str
    count: int
    median_price: Optional[float] = None
    median_required_rent: Optional[float] = None
    median_required_rent_after_hoa: Optional[float] = None


@dataclass
class MarketAnalytics:
    count: int
    median_price: Optional[float] = None
    median_price_per_sqft: Optional[float] = None
    median_hoa: Optional[float] = None
    pct_hoa_over_500: Optional[float] = None
    median_dom: Optional[float] = None
    baselines_by_area: list[MarketBaseline] = field(default_factory=list)
    baselines_by_city: list[dict] = field(default_factory=list)
    deals_vs_baseline: dict[str, int] = field(default_factory=dict)
    signals: InvestmentSignals = field(default_factory=InvestmentSignals)
    yield_bands: list[YieldProxyBand] = field(default_factory=list)
    property_type_counts: dict[str, int] = field(default_factory=dict)


def load_search_thresholds() -> dict:
    if not SEARCH_CRITERIA_PATH.exists():
        return {}
    try:
        return json.loads(SEARCH_CRITERIA_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def search_price_range(criteria: dict | None = None) -> tuple[float, float]:
    criteria = criteria or load_search_thresholds()
    price_range = (criteria.get('property_filters') or {}).get('price_range') or {}
    return (
        float(price_range.get('min', DEFAULT_PRICE_MIN)),
        float(price_range.get('max', DEFAULT_PRICE_MAX)),
    )


def search_beds_min(criteria: dict | None = None) -> int:
    criteria = criteria or load_search_thresholds()
    return int((criteria.get('property_filters') or {}).get('beds_min', DEFAULT_BEDS_MIN))


def _median(values: list[float]) -> Optional[float]:
    return statistics.median(values) if values else None


def _pct(count: int, total: int) -> Optional[float]:
    if total <= 0:
        return None
    return round(100.0 * count / total, 1)


def _price_per_sqft(listing: MarketListing) -> Optional[float]:
    if listing.asking_price and listing.sqft and listing.sqft > 0:
        return listing.asking_price / listing.sqft
    return None


def _normalize_property_type(value: str | None) -> str:
    if not value:
        return 'unknown'
    normalized = value.strip().lower().replace(' ', '_')
    if normalized.isdigit():
        return 'other'
    return normalized


def _is_condo_type(property_type: str | None) -> bool:
    normalized = _normalize_property_type(property_type)
    return normalized in {'condo', 'condominium'}


def required_monthly_rent_for_gross_yield(price: float, target: float = GROSS_YIELD_TARGET) -> float:
    return price * target / 12


def required_rent_after_hoa(price: float, hoa_monthly: float, target: float = GROSS_YIELD_TARGET) -> float:
    return required_monthly_rent_for_gross_yield(price, target) + hoa_monthly


def compute_area_baseline(listings: list[MarketListing], market_area: str) -> MarketBaseline:
    area_listings = [item for item in listings if item.market_area == market_area]
    prices = [item.asking_price for item in area_listings if item.asking_price is not None]
    ppsf = [_price_per_sqft(item) for item in area_listings]
    ppsf = [value for value in ppsf if value is not None]
    hoas = [item.hoa_monthly for item in area_listings if item.hoa_monthly is not None]
    doms = [item.days_on_market for item in area_listings if item.days_on_market is not None]
    price_min, price_max = search_price_range()
    in_range = [
        item
        for item in area_listings
        if item.asking_price is not None and price_min <= item.asking_price <= price_max
    ]
    condos = sum(1 for item in area_listings if _is_condo_type(item.property_type))
    hoa_over = sum(1 for item in area_listings if item.hoa_monthly is not None and item.hoa_monthly > HOA_SCRUTINY_MONTHLY)

    return MarketBaseline(
        market_area=market_area,
        count=len(area_listings),
        median_price=_median(prices),
        median_price_per_sqft=_median(ppsf),
        median_hoa=_median(hoas),
        pct_hoa_over_500=_pct(hoa_over, len(area_listings)),
        median_dom=_median([float(value) for value in doms]),
        pct_condo=_pct(condos, len(area_listings)),
        pct_in_price_range=_pct(len(in_range), len(area_listings)),
    )


def compute_investment_signals(
    listings: list[MarketListing],
    *,
    price_min: float | None = None,
    price_max: float | None = None,
    beds_min: int | None = None,
) -> InvestmentSignals:
    if price_min is None or price_max is None:
        price_min, price_max = search_price_range()
    if beds_min is None:
        beds_min = search_beds_min()

    ppsf_values = [_price_per_sqft(item) for item in listings]
    ppsf_values = [value for value in ppsf_values if value is not None]
    median_ppsf = _median(ppsf_values)

    hoas = [item.hoa_monthly for item in listings if item.hoa_monthly is not None]
    median_hoa = _median(hoas)

    under_ppsf = 0
    low_hoa = 0
    scout_range = 0
    hoa_over = 0

    for item in listings:
        ppsf = _price_per_sqft(item)
        if median_ppsf is not None and ppsf is not None and ppsf < median_ppsf:
            under_ppsf += 1
        if (
            item.hoa_monthly is not None
            and median_hoa is not None
            and item.hoa_monthly < median_hoa
        ):
            low_hoa += 1
        if item.hoa_monthly is not None and item.hoa_monthly > HOA_SCRUTINY_MONTHLY:
            hoa_over += 1
        if (
            item.asking_price is not None
            and price_min <= item.asking_price <= price_max
            and item.beds is not None
            and item.beds >= beds_min
        ):
            scout_range += 1

    return InvestmentSignals(
        under_median_price_per_sqft=under_ppsf,
        low_hoa_vs_area=low_hoa,
        scout_price_range_2br_plus=scout_range,
        hoa_over_scrutiny=hoa_over,
        median_price_per_sqft=median_ppsf,
        median_hoa=median_hoa,
    )


def compute_yield_proxy_bands(listings: list[MarketListing]) -> list[YieldProxyBand]:
    """Price bands with rent required for 10% gross yield (proxy — not verified rent)."""
    bands = [
        ('Under $200k', 0, 200_000),
        ('$200k–$350k', 200_000, 350_000),
        ('$350k–$500k', 350_000, 500_000),
        ('$500k–$750k', 500_000, 750_000),
        ('Over $750k', 750_000, None),
    ]
    results: list[YieldProxyBand] = []
    for label, low, high in bands:
        band_listings = [
            item
            for item in listings
            if item.asking_price is not None
            and item.asking_price >= low
            and (high is None or item.asking_price < high)
        ]
        prices = [item.asking_price for item in band_listings if item.asking_price is not None]
        required_rents = [required_monthly_rent_for_gross_yield(price) for price in prices]
        required_after_hoa = [
            required_rent_after_hoa(item.asking_price, item.hoa_monthly or 0)
            for item in band_listings
            if item.asking_price is not None
        ]
        results.append(
            YieldProxyBand(
                label=label,
                count=len(band_listings),
                median_price=_median(prices),
                median_required_rent=_median(required_rents),
                median_required_rent_after_hoa=_median(required_after_hoa),
            )
        )
    return results


def compute_market_analytics(
    listings: list[MarketListing],
    *,
    enriched: list | None = None,
) -> MarketAnalytics:
    prices = [item.asking_price for item in listings if item.asking_price is not None]
    ppsf = [_price_per_sqft(item) for item in listings]
    ppsf = [value for value in ppsf if value is not None]
    hoas = [item.hoa_monthly for item in listings if item.hoa_monthly is not None]
    doms = [item.days_on_market for item in listings if item.days_on_market is not None]
    hoa_over = sum(1 for item in listings if item.hoa_monthly is not None and item.hoa_monthly > HOA_SCRUTINY_MONTHLY)

    type_counts: dict[str, int] = {}
    for item in listings:
        key = _normalize_property_type(item.property_type)
        type_counts[key] = type_counts.get(key, 0) + 1

    areas = sorted({item.market_area for item in listings if item.market_area})
    baselines = [compute_area_baseline(listings, area) for area in areas]

    city_rows: list[dict] = []
    deals_vs_baseline: dict[str, int] = {}
    if enriched:
        from market_enrichment import city_baselines_to_rows, compute_city_baselines, deals_vs_baseline_counts

        city_baselines = compute_city_baselines(enriched)
        city_rows = city_baselines_to_rows(city_baselines)
        deals_vs_baseline = deals_vs_baseline_counts(enriched)

    return MarketAnalytics(
        count=len(listings),
        median_price=_median(prices),
        median_price_per_sqft=_median(ppsf),
        median_hoa=_median(hoas),
        pct_hoa_over_500=_pct(hoa_over, len(listings)),
        median_dom=_median([float(value) for value in doms]),
        baselines_by_area=baselines,
        baselines_by_city=city_rows,
        deals_vs_baseline=deals_vs_baseline,
        signals=compute_investment_signals(listings),
        yield_bands=compute_yield_proxy_bands(listings),
        property_type_counts=type_counts,
    )


def baselines_to_rows(baselines: list[MarketBaseline]) -> list[dict]:
    rows = []
    for item in baselines:
        rows.append(
            {
                'Market area': item.market_area.title(),
                'Listings': item.count,
                'Median price': item.median_price,
                'Median $/sqft': item.median_price_per_sqft,
                'Median HOA': item.median_hoa,
                'HOA > $500': item.pct_hoa_over_500,
                'Median DOM': item.median_dom,
                '% Condo': item.pct_condo,
                'In scout price range': item.pct_in_price_range,
            }
        )
    return rows
