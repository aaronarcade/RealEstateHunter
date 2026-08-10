"""Supabase client for RealEstateHunter."""

import os
from typing import Optional, List
from supabase import create_client, Client

from .types import PropertyOpportunity, ListOpportunitiesOptions, SyncResult, PropertyStatus
from .mapper import row_to_opportunity, opportunity_to_row


PROPERTIES_TABLE = 'properties'


class SupabaseClient:
    """Supabase client wrapper for RealEstateHunter."""

    def __init__(
        self,
        url: Optional[str] = None,
        anon_key: Optional[str] = None,
        service_role_key: Optional[str] = None
    ):
        """Initialize Supabase client.

        Args:
            url: Supabase project URL. Defaults to SUPABASE_URL env var.
            anon_key: Anonymous key for client reads. Defaults to SUPABASE_ANON_KEY env var.
            service_role_key: Service role key for server operations. Defaults to SUPABASE_SERVICE_ROLE_KEY env var.
        """
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
        """Get the underlying Supabase client."""
        return self._client

    def list_opportunities(
        self,
        options: Optional[ListOpportunitiesOptions] = None
    ) -> List[PropertyOpportunity]:
        """List property opportunities.

        Args:
            options: Query options for filtering and pagination.

        Returns:
            List of PropertyOpportunity objects.
        """
        options = options or ListOpportunitiesOptions()
        query = self._client.table(PROPERTIES_TABLE).select('*')

        if options.status:
            query = query.in_('status', options.status)

        if options.min_cap_rate is not None:
            query = query.gte('cap_rate', options.min_cap_rate)

        query = query.order('cap_rate', desc=True)

        if options.limit:
            query = query.limit(options.limit)

        if options.offset:
            query = query.range(options.offset, options.offset + (options.limit or 100) - 1)

        response = query.execute()
        return [row_to_opportunity(row) for row in response.data]

    def get_property(self, property_id: str) -> Optional[PropertyOpportunity]:
        """Get a single property by ID.

        Args:
            property_id: The property slug/ID.

        Returns:
            PropertyOpportunity if found, None otherwise.
        """
        response = (
            self._client.table(PROPERTIES_TABLE)
            .select('*')
            .eq('id', property_id)
            .execute()
        )

        if not response.data:
            return None

        return row_to_opportunity(response.data[0])

    def upsert_property(
        self,
        opportunity: PropertyOpportunity,
        workflow_state: str = 'PUBLISHED'
    ) -> None:
        """Upsert a single property.

        Args:
            opportunity: The property opportunity to upsert.
            workflow_state: Workflow state to set. Defaults to 'PUBLISHED'.
        """
        row = opportunity_to_row(opportunity, workflow_state)
        self._client.table(PROPERTIES_TABLE).upsert(row).execute()

    def upsert_properties(
        self,
        opportunities: List[PropertyOpportunity],
        workflow_state: str = 'PUBLISHED'
    ) -> SyncResult:
        """Upsert multiple properties.

        Args:
            opportunities: List of property opportunities to upsert.
            workflow_state: Workflow state to set. Defaults to 'PUBLISHED'.

        Returns:
            SyncResult with counts of inserted/updated records and any errors.
        """
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
        except Exception as e:
            result.errors.append({'id': 'batch', 'error': str(e)})

        return result

    def delete_property(self, property_id: str) -> bool:
        """Delete a property by ID.

        Args:
            property_id: The property slug/ID to delete.

        Returns:
            True if deleted, False if not found.
        """
        response = (
            self._client.table(PROPERTIES_TABLE)
            .delete()
            .eq('id', property_id)
            .execute()
        )
        return len(response.data) > 0


def list_opportunities(
    client: SupabaseClient,
    options: Optional[ListOpportunitiesOptions] = None
) -> List[PropertyOpportunity]:
    """List property opportunities using provided client.

    Args:
        client: SupabaseClient instance.
        options: Query options for filtering and pagination.

    Returns:
        List of PropertyOpportunity objects.
    """
    return client.list_opportunities(options)


def get_property(
    client: SupabaseClient,
    property_id: str
) -> Optional[PropertyOpportunity]:
    """Get a single property by ID using provided client.

    Args:
        client: SupabaseClient instance.
        property_id: The property slug/ID.

    Returns:
        PropertyOpportunity if found, None otherwise.
    """
    return client.get_property(property_id)
