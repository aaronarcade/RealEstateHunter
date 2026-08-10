"""
Query functions for RealEstateHunter Supabase data
"""

from typing import Any, Optional

from supabase import Client

from .types import (
    PropertyRow,
    PropertyOpportunity,
    ListOpportunitiesOptions,
)


def row_to_opportunity(row: dict) -> PropertyOpportunity:
    """Convert a Supabase row dict to a PropertyOpportunity"""
    property_row = PropertyRow.from_dict(row)
    return PropertyOpportunity.from_row(property_row)


def list_opportunities(
    client: Client,
    options: Optional[ListOpportunitiesOptions] = None,
) -> list[PropertyOpportunity]:
    """
    List property opportunities with optional filters.

    Args:
        client: Supabase client
        options: Filter and pagination options

    Returns:
        List of PropertyOpportunity objects
    """
    if options is None:
        options = ListOpportunitiesOptions()

    query = client.table("properties").select("*")

    # Apply filters
    if options.status:
        query = query.eq("status", options.status)

    if options.min_cap_rate is not None:
        query = query.gte("cap_rate", options.min_cap_rate)

    if options.max_cap_rate is not None:
        query = query.lte("cap_rate", options.max_cap_rate)

    if options.confidence:
        query = query.eq("confidence", options.confidence)

    if options.workflow_state:
        if isinstance(options.workflow_state, list):
            query = query.in_("workflow_state", options.workflow_state)
        else:
            query = query.eq("workflow_state", options.workflow_state)

    # Apply ordering
    ascending = options.order_direction == "asc"
    query = query.order(options.order_by, desc=not ascending)

    # Apply pagination
    if options.limit is not None:
        query = query.limit(options.limit)

    if options.offset is not None:
        end = options.offset + (options.limit or 100) - 1
        query = query.range(options.offset, end)

    response = query.execute()

    if not response.data:
        return []

    return [row_to_opportunity(row) for row in response.data]


def get_property(client: Client, property_id: str) -> Optional[PropertyOpportunity]:
    """
    Get a single property by ID.

    Args:
        client: Supabase client
        property_id: Property ID (slug)

    Returns:
        PropertyOpportunity or None if not found
    """
    response = (
        client.table("properties").select("*").eq("id", property_id).execute()
    )

    if not response.data:
        return None

    return row_to_opportunity(response.data[0])


def get_property_with_details(
    client: Client, property_id: str
) -> Optional[dict[str, Any]]:
    """
    Get property with full details (evidence, underwriting, audit).

    Args:
        client: Supabase client
        property_id: Property ID (slug)

    Returns:
        Property dict with details or None if not found
    """
    prop_response = (
        client.table("properties").select("*").eq("id", property_id).execute()
    )

    if not prop_response.data:
        return None

    opportunity = row_to_opportunity(prop_response.data[0])

    details_response = (
        client.table("property_details")
        .select("*")
        .eq("property_id", property_id)
        .execute()
    )

    details = details_response.data[0] if details_response.data else {}

    return {
        **opportunity.to_dict(),
        "evidence": details.get("evidence"),
        "underwriting": details.get("underwriting"),
        "audit": details.get("audit"),
    }


def count_opportunities(
    client: Client,
    options: Optional[ListOpportunitiesOptions] = None,
) -> int:
    """
    Count properties matching filters.

    Args:
        client: Supabase client
        options: Filter options

    Returns:
        Count of matching properties
    """
    if options is None:
        options = ListOpportunitiesOptions()

    query = client.table("properties").select("id", count="exact")

    if options.status:
        query = query.eq("status", options.status)

    if options.min_cap_rate is not None:
        query = query.gte("cap_rate", options.min_cap_rate)

    if options.max_cap_rate is not None:
        query = query.lte("cap_rate", options.max_cap_rate)

    if options.confidence:
        query = query.eq("confidence", options.confidence)

    if options.workflow_state:
        if isinstance(options.workflow_state, list):
            query = query.in_("workflow_state", options.workflow_state)
        else:
            query = query.eq("workflow_state", options.workflow_state)

    response = query.execute()

    return response.count or 0


def get_viable_opportunities(
    client: Client, limit: int = 50
) -> list[PropertyOpportunity]:
    """
    Get VIABLE opportunities sorted by cap rate.

    Convenience function for the most common UI query.

    Args:
        client: Supabase client
        limit: Maximum number of results

    Returns:
        List of viable PropertyOpportunity objects
    """
    return list_opportunities(
        client,
        ListOpportunitiesOptions(
            status="VIABLE",
            workflow_state=["RANKED", "PUBLISHED"],
            order_by="cap_rate",
            order_direction="desc",
            limit=limit,
        ),
    )


def get_watchlist_opportunities(
    client: Client, limit: int = 50
) -> list[PropertyOpportunity]:
    """
    Get WATCHLIST opportunities sorted by cap rate.

    Args:
        client: Supabase client
        limit: Maximum number of results

    Returns:
        List of watchlist PropertyOpportunity objects
    """
    return list_opportunities(
        client,
        ListOpportunitiesOptions(
            status="WATCHLIST",
            workflow_state=["RANKED", "PUBLISHED"],
            order_by="cap_rate",
            order_direction="desc",
            limit=limit,
        ),
    )
