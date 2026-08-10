"""Sort opportunities per PRODUCT.md ranking rules (parity with ui/src/data/sorting.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

from db_client.types import PropertyOpportunity, ConfidenceLevel, PropertyStatus

SortField = Literal['status', 'confidence', 'cap_rate', 'noi']
SortDirection = Literal['asc', 'desc']

STATUS_ORDER: dict[PropertyStatus, int] = {
    'VIABLE': 0,
    'WATCHLIST': 1,
    'REJECTED': 2,
}

CONFIDENCE_ORDER: dict[ConfidenceLevel, int] = {
    'HIGH': 0,
    'MEDIUM': 1,
    'LOW': 2,
}


@dataclass
class SortConfig:
    field: SortField
    direction: SortDirection


def _compare_by_field(a: PropertyOpportunity, b: PropertyOpportunity, field: SortField) -> float:
    if field == 'status':
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if field == 'confidence':
        return CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence]
    if field == 'cap_rate':
        return a.cap_rate - b.cap_rate
    if field == 'noi':
        return a.noi - b.noi
    return 0.0


def sort_opportunities(
    opportunities: list[PropertyOpportunity],
    config: Optional[SortConfig] = None,
) -> list[PropertyOpportunity]:
    """Sort opportunities; default order matches React UI."""
    sorted_list = list(opportunities)

    if config:
        sorted_list.sort(
            key=lambda item: _field_sort_key(item, config.field),
            reverse=config.direction == 'desc',
        )
        return sorted_list

    sorted_list.sort(
        key=lambda o: (
            STATUS_ORDER[o.status],
            CONFIDENCE_ORDER[o.confidence],
            -o.cap_rate,
            -o.noi,
        )
    )
    return sorted_list


def _field_sort_key(item: PropertyOpportunity, field: SortField) -> float | int:
    if field == 'status':
        return STATUS_ORDER[item.status]
    if field == 'confidence':
        return CONFIDENCE_ORDER[item.confidence]
    if field == 'cap_rate':
        return item.cap_rate
    return item.noi


def get_next_sort_direction(
    current: Optional[SortConfig],
    field: SortField,
) -> SortConfig:
    """Toggle sort direction; matches ui/src/data/sorting.ts."""
    if current and current.field == field:
        return SortConfig(field=field, direction='desc' if current.direction == 'asc' else 'asc')

    default_desc: set[SortField] = {'cap_rate', 'noi'}
    return SortConfig(field=field, direction='desc' if field in default_desc else 'asc')
