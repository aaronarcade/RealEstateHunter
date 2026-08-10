"""Supabase client for RealEstateHunter — reads RealEstateTracker unit data."""

from __future__ import annotations

import os
from typing import Optional, List

from supabase import create_client, Client

from .types import PropertyOpportunity, ListOpportunitiesOptions, SyncResult, PropertyStatus
from .mapper import row_to_opportunity, opportunity_to_row
from .tracker_mapper import tracker_row_to_opportunity

PROPERTIES_TABLE = 'properties'
UNIT_FINANCIALS_VIEW = 'unit_financials'
CAP_RATE_RPC = 'get_cap_rate_summary'
SOURCE_PRIORITY = ('scraper', 'zillow', 'agent', 'county_assessor', 'manual')


class SupabaseClient:
    """Supabase client wrapper for RealEstateHunter."""

    def __init__(
        self,
        url: Optional[str] = None,
        anon_key: Optional[str] = None,
        service_role_key: Optional[str] = None,
    ):
        self.url = url or os.environ.get('SUPABASE_URL', '')
        self.anon_key = anon_key or os.environ.get('SUPABASE_ANON_KEY')
        self.service_role_key = service_role_key or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

        if not self.url:
            raise ValueError('SUPABASE_URL is required. Set it in environment or pass to constructor.')

        key = self.service_role_key or self.anon_key
        if not key:
            raise ValueError('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required.')

        self._client: Client = create_client(self.url, key)

    @property
    def client(self) -> Client:
        return self._client

    def _fetch_unit_financials(self, unit_ids: list[str]) -> dict[str, dict]:
        if not unit_ids:
            return {}
        response = (
            self._client.table(UNIT_FINANCIALS_VIEW)
            .select('*')
            .in_('unit_id', unit_ids)
            .execute()
        )
        return {str(row['unit_id']): row for row in (response.data or [])}

    def _fetch_primary_sources(self, unit_ids: list[str]) -> dict[str, dict]:
        if not unit_ids:
            return {}
        response = (
            self._client.table('data_sources')
            .select('entity_id, source_url, source_type, confidence, created_at')
            .eq('entity_type', 'unit')
            .in_('entity_id', unit_ids)
            .execute()
        )
        grouped: dict[str, list[dict]] = {}
        for row in response.data or []:
            grouped.setdefault(str(row['entity_id']), []).append(row)

        selected: dict[str, dict] = {}
        for unit_id, rows in grouped.items():
            with_url = [row for row in rows if row.get('source_url')]
            if not with_url:
                continue
            with_url.sort(
                key=lambda row: (
                    SOURCE_PRIORITY.index(row['source_type'])
                    if row.get('source_type') in SOURCE_PRIORITY
                    else len(SOURCE_PRIORITY),
                    row.get('created_at') or '',
                )
            )
            selected[unit_id] = with_url[0]
        return selected

    def list_tracker_opportunities(
        self,
        options: Optional[ListOpportunitiesOptions] = None,
    ) -> List[PropertyOpportunity]:
        """Load units from RealEstateTracker via get_cap_rate_summary."""
        options = options or ListOpportunitiesOptions()
        response = self._client.rpc(CAP_RATE_RPC, {}).execute()
        rows = response.data or []

        unit_ids = [str(row['unit_id']) for row in rows if row.get('unit_id')]
        financials_by_id = self._fetch_unit_financials(unit_ids)
        sources_by_id = self._fetch_primary_sources(unit_ids)

        opportunities: list[PropertyOpportunity] = []
        for row in rows:
            unit_id = str(row.get('unit_id'))
            source = sources_by_id.get(unit_id, {})
            opportunity = tracker_row_to_opportunity(
                row,
                financials=financials_by_id.get(unit_id),
                source_url=source.get('source_url'),
                source_confidence=source.get('confidence'),
            )
            if options.status and opportunity.status not in options.status:
                continue
            if options.min_cap_rate is not None and opportunity.cap_rate < options.min_cap_rate:
                continue
            opportunities.append(opportunity)

        opportunities.sort(key=lambda item: item.cap_rate, reverse=True)

        if options.offset:
            opportunities = opportunities[options.offset :]
        if options.limit:
            opportunities = opportunities[: options.limit]

        return opportunities

    def list_opportunities(
        self,
        options: Optional[ListOpportunitiesOptions] = None,
    ) -> List[PropertyOpportunity]:
        """List opportunities from the shared RealEstateTracker database."""
        return self.list_tracker_opportunities(options)

    def get_property(self, property_id: str) -> Optional[PropertyOpportunity]:
        """Get a single unit opportunity by unit UUID."""
        response = self._client.rpc(CAP_RATE_RPC, {}).execute()
        rows = [row for row in (response.data or []) if str(row.get('unit_id')) == property_id]
        if not rows:
            return None

        financials = self._fetch_unit_financials([property_id]).get(property_id)
        source = self._fetch_primary_sources([property_id]).get(property_id, {})
        return tracker_row_to_opportunity(
            rows[0],
            financials=financials,
            source_url=source.get('source_url'),
            source_confidence=source.get('confidence'),
        )

    def upsert_property(
        self,
        opportunity: PropertyOpportunity,
        workflow_state: str = 'PUBLISHED',
    ) -> None:
        row = opportunity_to_row(opportunity, workflow_state)
        self._client.table(PROPERTIES_TABLE).upsert(row).execute()

    def upsert_properties(
        self,
        opportunities: List[PropertyOpportunity],
        workflow_state: str = 'PUBLISHED',
    ) -> SyncResult:
        result = SyncResult()
        if not opportunities:
            return result

        ids = [o.id for o in opportunities]
        existing_response = (
            self._client.table(PROPERTIES_TABLE)
            .select('id')
            .in_('id', ids)
            .execute()
        )
        existing_ids = {row['id'] for row in existing_response.data}

        rows = [opportunity_to_row(o, workflow_state) for o in opportunities]
        try:
            self._client.table(PROPERTIES_TABLE).upsert(rows).execute()
            for row in rows:
                if row['id'] in existing_ids:
                    result.updated += 1
                else:
                    result.inserted += 1
        except Exception as exc:
            result.errors.append({'id': 'batch', 'error': str(exc)})

        return result

    def delete_property(self, property_id: str) -> bool:
        response = (
            self._client.table(PROPERTIES_TABLE)
            .delete()
            .eq('id', property_id)
            .execute()
        )
        return len(response.data) > 0


def list_opportunities(
    client: SupabaseClient,
    options: Optional[ListOpportunitiesOptions] = None,
) -> List[PropertyOpportunity]:
    return client.list_opportunities(options)


def get_property(
    client: SupabaseClient,
    property_id: str,
) -> Optional[PropertyOpportunity]:
    return client.get_property(property_id)
