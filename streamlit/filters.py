"""Location and status filters for the opportunity browser."""

from __future__ import annotations

from db_client.types import PropertyOpportunity, PropertyStatus


def countries(opportunities: list[PropertyOpportunity]) -> list[str]:
    return sorted({opp.country or 'Unknown' for opp in opportunities})


def regions(opportunities: list[PropertyOpportunity], country: str | None = None) -> list[str]:
    rows = opportunities
    if country and country != 'All':
        rows = [opp for opp in rows if (opp.country or 'Unknown') == country]
    return sorted({opp.region or 'Unknown' for opp in rows if opp.region})


def neighborhoods(
    opportunities: list[PropertyOpportunity],
    country: str | None = None,
    region: str | None = None,
) -> list[str]:
    rows = opportunities
    if country and country != 'All':
        rows = [opp for opp in rows if (opp.country or 'Unknown') == country]
    if region and region != 'All':
        rows = [opp for opp in rows if opp.region == region]
    return sorted({opp.neighborhood or 'Unknown' for opp in rows if opp.neighborhood})


def apply_filters(
    opportunities: list[PropertyOpportunity],
    *,
    country: str = 'All',
    region: str = 'All',
    neighborhood: str = 'All',
    status: str = 'All',
) -> list[PropertyOpportunity]:
    rows = opportunities
    if country != 'All':
        rows = [opp for opp in rows if (opp.country or 'Unknown') == country]
    if region != 'All':
        rows = [opp for opp in rows if opp.region == region]
    if neighborhood != 'All':
        rows = [opp for opp in rows if opp.neighborhood == neighborhood]
    if status != 'All':
        rows = [opp for opp in rows if opp.status == status]
    return rows
