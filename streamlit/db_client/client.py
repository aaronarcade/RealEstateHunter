"""Supabase client for RealEstateHunter — reads RealEstateTracker unit data."""

from __future__ import annotations

import os
from typing import Optional, List

from supabase import create_client, Client

from .types import PropertyOpportunity, ListOpportunitiesOptions, SyncResult
from reviewed_types import ListReviewedOptions, ReviewedListing
from market_types import ListMarketOptions, MarketListing
from .mapper import row_to_opportunity, opportunity_to_row
from .reviewed_mapper import row_to_reviewed
from .market_mapper import row_to_market
from .tracker_mapper import tracker_financials_to_opportunity, tracker_row_to_opportunity

PROPERTIES_TABLE = 'properties'
REVIEWED_LISTINGS_TABLE = 'reviewed_listings'
MARKET_LISTINGS_TABLE = 'market_listings'
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
        self.uses_service_role = bool(self.service_role_key)
        self._image_url_2_available: bool | None = None

    @property
    def client(self) -> Client:
        return self._client

    def _supports_image_url_2(self) -> bool:
        if self._image_url_2_available is not None:
            return self._image_url_2_available
        try:
            self._client.table('units').select('image_url_2').limit(1).execute()
            self._image_url_2_available = True
        except Exception:
            self._image_url_2_available = False
        return self._image_url_2_available

    def _fetch_all_unit_financials(self) -> list[dict]:
        response = self._client.table(UNIT_FINANCIALS_VIEW).select('*').execute()
        return response.data or []

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

    def _unit_image_select(self) -> str:
        fields = 'id, image_url, building_id'
        if self._supports_image_url_2():
            fields += ', image_url_2'
        return fields

    def _fetch_unit_images(self, unit_ids: list[str]) -> dict[str, dict]:
        if not unit_ids:
            return {}
        try:
            response = (
                self._client.table('units')
                .select(self._unit_image_select())
                .in_('id', unit_ids)
                .execute()
            )
            return {str(row['id']): row for row in (response.data or [])}
        except Exception:
            return {}

    def _fetch_buildings_context(self, building_ids: list[str]) -> dict[str, dict]:
        if not building_ids:
            return {}
        select = 'id, address, alias, image_url, neighborhoods(name, image_url, regions(name, countries(name)))'
        if self._supports_image_url_2():
            select = 'id, address, alias, image_url, image_url_2, neighborhoods(name, image_url, regions(name, countries(name)))'
        try:
            response = (
                self._client.table('buildings')
                .select(select)
                .in_('id', building_ids)
                .execute()
            )
            return {str(row['id']): row for row in (response.data or [])}
        except Exception:
            try:
                response = (
                    self._client.table('buildings')
                    .select('id, address, alias, image_url, neighborhoods(name, regions(name, countries(name)))')
                    .in_('id', building_ids)
                    .execute()
                )
                return {str(row['id']): row for row in (response.data or [])}
            except Exception:
                return {}

    def _resolve_unit_images(
        self,
        unit_id: str,
        unit_images: dict[str, dict],
        building: dict | None,
    ) -> dict[str, str | None]:
        images = unit_images.get(unit_id, {})
        image_url = images.get('image_url')
        image_url_2 = images.get('image_url_2')
        if not image_url and building:
            image_url = building.get('image_url')
        if not image_url_2 and building:
            image_url_2 = building.get('image_url_2')
        neighborhood = (building or {}).get('neighborhoods') or {}
        if not image_url:
            image_url = neighborhood.get('image_url')
        return {'image_url': image_url, 'image_url_2': image_url_2}

    def _fetch_primary_sources(self, unit_ids: list[str]) -> dict[str, dict]:
        if not unit_ids:
            return {}
        try:
            response = (
                self._client.table('data_sources')
                .select('entity_id, source_url, source_type, confidence, created_at')
                .eq('entity_type', 'unit')
                .in_('entity_id', unit_ids)
                .execute()
            )
        except Exception:
            return {}

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

    def _fetch_properties_table(self) -> list[PropertyOpportunity]:
        try:
            response = self._client.table(PROPERTIES_TABLE).select('*').execute()
        except Exception:
            return []
        return [row_to_opportunity(row) for row in (response.data or [])]

    def _filter_opportunities(
        self,
        opportunities: list[PropertyOpportunity],
        options: ListOpportunitiesOptions,
    ) -> list[PropertyOpportunity]:
        filtered = opportunities
        if options.status:
            filtered = [item for item in filtered if item.status in options.status]
        if options.min_cap_rate is not None:
            filtered = [item for item in filtered if item.cap_rate >= options.min_cap_rate]
        filtered.sort(key=lambda item: item.cap_rate, reverse=True)
        if options.offset:
            filtered = filtered[options.offset :]
        if options.limit:
            filtered = filtered[: options.limit]
        return filtered

    def _load_from_rpc(self) -> list[PropertyOpportunity]:
        response = self._client.rpc(CAP_RATE_RPC, {}).execute()
        rows = response.data or []
        if not rows:
            return []

        unit_ids = [str(row['unit_id']) for row in rows if row.get('unit_id')]
        financials_by_id = self._fetch_unit_financials(unit_ids)
        sources_by_id = self._fetch_primary_sources(unit_ids)
        unit_images_by_id = self._fetch_unit_images(unit_ids)
        building_ids = list({str(row['building_id']) for row in rows if row.get('building_id')})
        buildings_by_id = self._fetch_buildings_context(building_ids)

        opportunities: list[PropertyOpportunity] = []
        for row in rows:
            unit_id = str(row.get('unit_id'))
            source = sources_by_id.get(unit_id, {})
            building = buildings_by_id.get(str(row.get('building_id')))
            images = self._resolve_unit_images(unit_id, unit_images_by_id, building)
            opportunities.append(
                tracker_row_to_opportunity(
                    row,
                    financials=financials_by_id.get(unit_id),
                    source_url=source.get('source_url'),
                    source_confidence=source.get('confidence'),
                    unit_images=images,
                    property_type=row.get('property_type'),
                )
            )
        return opportunities

    def _load_from_unit_financials(self) -> list[PropertyOpportunity]:
        financials_rows = self._fetch_all_unit_financials()
        if not financials_rows:
            return []

        building_ids = list({str(row['building_id']) for row in financials_rows if row.get('building_id')})
        buildings_by_id = self._fetch_buildings_context(building_ids)
        unit_ids = [str(row['unit_id']) for row in financials_rows if row.get('unit_id')]
        sources_by_id = self._fetch_primary_sources(unit_ids)
        unit_images_by_id = self._fetch_unit_images(unit_ids)

        opportunities: list[PropertyOpportunity] = []
        for fin in financials_rows:
            unit_id = str(fin.get('unit_id'))
            building = buildings_by_id.get(str(fin.get('building_id')))
            source = sources_by_id.get(unit_id, {})
            images = self._resolve_unit_images(unit_id, unit_images_by_id, building)
            opportunities.append(
                tracker_financials_to_opportunity(
                    fin,
                    building=building,
                    source_url=source.get('source_url'),
                    source_confidence=source.get('confidence'),
                    unit_images=images,
                )
            )
        return opportunities

    def list_tracker_opportunities(
        self,
        options: Optional[ListOpportunitiesOptions] = None,
    ) -> List[PropertyOpportunity]:
        """Load units from RealEstateTracker (RPC, unit_financials, and properties fallbacks)."""
        options = options or ListOpportunitiesOptions()

        opportunities = self._load_from_rpc()
        if not opportunities:
            opportunities = self._load_from_unit_financials()

        by_id = {item.id: item for item in opportunities}
        for item in self._fetch_properties_table():
            by_id.setdefault(item.id, item)

        return self._filter_opportunities(list(by_id.values()), options)

    def list_opportunities(
        self,
        options: Optional[ListOpportunitiesOptions] = None,
    ) -> List[PropertyOpportunity]:
        return self.list_tracker_opportunities(options)

    def get_property(self, property_id: str) -> Optional[PropertyOpportunity]:
        for item in self.list_tracker_opportunities():
            if item.id == property_id:
                return item
        return None

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

    def list_reviewed_listings(
        self,
        options: Optional[ListReviewedOptions] = None,
    ) -> List[ReviewedListing]:
        options = options or ListReviewedOptions()
        try:
            response = (
                self._client.table(REVIEWED_LISTINGS_TABLE)
                .select('*')
                .order('reviewed_at', desc=True)
                .execute()
            )
        except Exception:
            return []

        listings = [row_to_reviewed(row) for row in (response.data or [])]
        return self._filter_reviewed_listings(listings, options)

    def _filter_reviewed_listings(
        self,
        listings: list[ReviewedListing],
        options: ListReviewedOptions,
    ) -> list[ReviewedListing]:
        filtered = listings
        if options.country:
            filtered = [item for item in filtered if item.country == options.country]
        if options.city:
            filtered = [item for item in filtered if item.city == options.city]
        if options.market_id:
            filtered = [item for item in filtered if item.market_id == options.market_id]
        if options.min_cap_rate is not None:
            filtered = [
                item
                for item in filtered
                if item.estimated_cap_rate is not None
                and item.estimated_cap_rate >= options.min_cap_rate
            ]
        if options.max_cap_rate is not None:
            filtered = [
                item
                for item in filtered
                if item.estimated_cap_rate is not None
                and item.estimated_cap_rate <= options.max_cap_rate
            ]
        if options.offset:
            filtered = filtered[options.offset :]
        if options.limit:
            filtered = filtered[: options.limit]
        return filtered

    def list_market_listings(
        self,
        options: Optional[ListMarketOptions] = None,
    ) -> List[MarketListing]:
        options = options or ListMarketOptions()
        try:
            response = (
                self._client.table(MARKET_LISTINGS_TABLE)
                .select('*')
                .order('scraped_at', desc=True)
                .execute()
            )
        except Exception:
            return []

        listings = [row_to_market(row) for row in (response.data or [])]
        return self._filter_market_listings(listings, options)

    def _filter_market_listings(
        self,
        listings: list[MarketListing],
        options: ListMarketOptions,
    ) -> list[MarketListing]:
        filtered = listings
        if options.market_area:
            filtered = [item for item in filtered if item.market_area == options.market_area]
        if options.city:
            filtered = [item for item in filtered if item.city == options.city]
        if options.scrape_batch:
            filtered = [item for item in filtered if item.scrape_batch == options.scrape_batch]
        if options.min_price is not None:
            filtered = [
                item
                for item in filtered
                if item.asking_price is not None and item.asking_price >= options.min_price
            ]
        if options.max_price is not None:
            filtered = [
                item
                for item in filtered
                if item.asking_price is not None and item.asking_price <= options.max_price
            ]
        if options.offset:
            filtered = filtered[options.offset :]
        if options.limit:
            filtered = filtered[: options.limit]
        return filtered


def list_market_listings(
    client: SupabaseClient,
    options: Optional[ListMarketOptions] = None,
) -> List[MarketListing]:
    return client.list_market_listings(options)


def list_reviewed_listings(
    client: SupabaseClient,
    options: Optional[ListReviewedOptions] = None,
) -> List[ReviewedListing]:
    return client.list_reviewed_listings(options)


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
