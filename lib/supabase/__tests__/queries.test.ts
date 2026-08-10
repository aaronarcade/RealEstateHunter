/**
 * Tests for Supabase query functions
 * Uses mocked Supabase responses (no live DB in CI)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyRow, PropertyOpportunity } from '../src/types.js';
import {
  rowToOpportunity,
  listOpportunities,
  getProperty,
  countOpportunities,
  getViableOpportunities,
} from '../src/queries.js';

// Mock property row matching _example data
const mockPropertyRow: PropertyRow = {
  id: '_example',
  address: '123 Example St, Tampa, FL 33602',
  location: 'Tampa, FL',
  listing_url: 'https://example.com/listing/123',
  purchase_price: {
    value: 200000,
    status: 'VERIFIED',
    confidence: 'HIGH',
    source: 'https://example.com/listing/123',
    evidence: 'Listing asking price $200,000',
  },
  monthly_rent: {
    value: 2200,
    status: 'ESTIMATED',
    confidence: 'MEDIUM',
    source: 'Rent comps',
    evidence: 'Comp A: $2,100/mo similar 2BR condo.',
    range_low: 2100,
    range_high: 2300,
  },
  hoa: {
    value: 485,
    status: 'VERIFIED',
    confidence: 'HIGH',
    source: 'https://example.com/listing/123',
    evidence: 'Listing states HOA $485/month',
  },
  assessment: {
    value: 0,
    status: 'VERIFIED',
    confidence: 'HIGH',
    source: 'HOA disclosure document',
    evidence: 'No current or planned special assessments',
  },
  annual_gross_rent: 26400,
  annual_operating_expenses: 12572,
  noi: 13828,
  cap_rate: 0.0691,
  confidence: 'MEDIUM',
  status: 'REJECTED',
  workflow_state: 'AUDIT',
  sources: [
    { label: 'Listing', url: 'https://example.com/listing/123' },
  ],
  ranked_at: null,
  synced_at: '2026-08-10T12:00:00Z',
  created_at: '2026-08-09T12:00:00Z',
  updated_at: '2026-08-09T18:00:00Z',
};

const mockViableRow: PropertyRow = {
  ...mockPropertyRow,
  id: 'viable-property',
  cap_rate: 0.112,
  status: 'VIABLE',
  confidence: 'HIGH',
  workflow_state: 'RANKED',
  ranked_at: '2026-08-10T10:00:00Z',
};

// Create a mock Supabase client
function createMockClient(mockData: PropertyRow[] = [mockPropertyRow]) {
  const mockQuery = {
    data: mockData,
    error: null,
    count: mockData.length,
  };

  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockData[0], error: null }),
    then: (resolve: (value: typeof mockQuery) => void) => {
      resolve(mockQuery);
      return Promise.resolve(mockQuery);
    },
  };

  // Make queryBuilder awaitable
  Object.defineProperty(queryBuilder, Symbol.toStringTag, { value: 'Promise' });

  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    _queryBuilder: queryBuilder,
  };
}

describe('rowToOpportunity', () => {
  it('should convert a PropertyRow to PropertyOpportunity', () => {
    const result = rowToOpportunity(mockPropertyRow);

    expect(result).toEqual<PropertyOpportunity>({
      id: '_example',
      address: '123 Example St, Tampa, FL 33602',
      location: 'Tampa, FL',
      listingUrl: 'https://example.com/listing/123',
      purchasePrice: mockPropertyRow.purchase_price,
      monthlyRent: mockPropertyRow.monthly_rent,
      annualGrossRent: 26400,
      annualOperatingExpenses: 12572,
      noi: 13828,
      capRate: 0.0691,
      hoa: mockPropertyRow.hoa,
      assessment: mockPropertyRow.assessment,
      confidence: 'MEDIUM',
      status: 'REJECTED',
      sources: mockPropertyRow.sources,
      rankedAt: undefined,
    });
  });

  it('should include rankedAt when present', () => {
    const result = rowToOpportunity(mockViableRow);
    expect(result.rankedAt).toBe('2026-08-10T10:00:00Z');
  });
});

describe('listOpportunities', () => {
  it('should call select on properties table', async () => {
    const mockClient = createMockClient();

    // Mock the awaitable behavior
    mockClient._queryBuilder.then = undefined as unknown as never;
    const selectPromise = Promise.resolve({ data: [mockPropertyRow], error: null });
    vi.spyOn(mockClient._queryBuilder, 'order').mockReturnValue(selectPromise as unknown as ReturnType<typeof mockClient._queryBuilder.order>);

    const result = await listOpportunities(mockClient as unknown as Parameters<typeof listOpportunities>[0]);

    expect(mockClient.from).toHaveBeenCalledWith('properties');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('_example');
  });

  it('should apply status filter', async () => {
    const mockClient = createMockClient([mockViableRow]);
    mockClient._queryBuilder.then = undefined as unknown as never;
    const selectPromise = Promise.resolve({ data: [mockViableRow], error: null });
    vi.spyOn(mockClient._queryBuilder, 'order').mockReturnValue(selectPromise as unknown as ReturnType<typeof mockClient._queryBuilder.order>);

    await listOpportunities(mockClient as unknown as Parameters<typeof listOpportunities>[0], {
      status: 'VIABLE',
    });

    expect(mockClient._queryBuilder.eq).toHaveBeenCalledWith('status', 'VIABLE');
  });

  it('should apply cap rate filters', async () => {
    const mockClient = createMockClient([mockViableRow]);
    mockClient._queryBuilder.then = undefined as unknown as never;
    const selectPromise = Promise.resolve({ data: [mockViableRow], error: null });
    vi.spyOn(mockClient._queryBuilder, 'order').mockReturnValue(selectPromise as unknown as ReturnType<typeof mockClient._queryBuilder.order>);

    await listOpportunities(mockClient as unknown as Parameters<typeof listOpportunities>[0], {
      minCapRate: 0.10,
      maxCapRate: 0.15,
    });

    expect(mockClient._queryBuilder.gte).toHaveBeenCalledWith('cap_rate', 0.10);
    expect(mockClient._queryBuilder.lte).toHaveBeenCalledWith('cap_rate', 0.15);
  });

  it('should apply workflow state array filter', async () => {
    const mockClient = createMockClient([mockViableRow]);
    mockClient._queryBuilder.then = undefined as unknown as never;
    const selectPromise = Promise.resolve({ data: [mockViableRow], error: null });
    vi.spyOn(mockClient._queryBuilder, 'order').mockReturnValue(selectPromise as unknown as ReturnType<typeof mockClient._queryBuilder.order>);

    await listOpportunities(mockClient as unknown as Parameters<typeof listOpportunities>[0], {
      workflowState: ['RANKED', 'PUBLISHED'],
    });

    expect(mockClient._queryBuilder.in).toHaveBeenCalledWith('workflow_state', ['RANKED', 'PUBLISHED']);
  });

  it('should handle errors', async () => {
    const mockClient = createMockClient();
    mockClient._queryBuilder.then = undefined as unknown as never;
    const errorPromise = Promise.resolve({ data: null, error: { message: 'Connection failed' } });
    vi.spyOn(mockClient._queryBuilder, 'order').mockReturnValue(errorPromise as unknown as ReturnType<typeof mockClient._queryBuilder.order>);

    await expect(
      listOpportunities(mockClient as unknown as Parameters<typeof listOpportunities>[0])
    ).rejects.toThrow('Failed to list opportunities: Connection failed');
  });
});

describe('getProperty', () => {
  it('should fetch a single property by ID', async () => {
    const mockClient = createMockClient([mockPropertyRow]);

    const result = await getProperty(
      mockClient as unknown as Parameters<typeof getProperty>[0],
      '_example'
    );

    expect(mockClient.from).toHaveBeenCalledWith('properties');
    expect(mockClient._queryBuilder.eq).toHaveBeenCalledWith('id', '_example');
    expect(result?.id).toBe('_example');
  });

  it('should return null for not found', async () => {
    const mockClient = createMockClient();
    vi.spyOn(mockClient._queryBuilder, 'single').mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await getProperty(
      mockClient as unknown as Parameters<typeof getProperty>[0],
      'nonexistent'
    );

    expect(result).toBeNull();
  });
});

describe('countOpportunities', () => {
  it('should return count of matching properties', async () => {
    const mockClient = createMockClient([mockPropertyRow, mockViableRow]);
    mockClient._queryBuilder.then = undefined as unknown as never;
    const countPromise = Promise.resolve({ count: 2, error: null });
    vi.spyOn(mockClient._queryBuilder, 'select').mockReturnValue(countPromise as unknown as ReturnType<typeof mockClient._queryBuilder.select>);

    const result = await countOpportunities(
      mockClient as unknown as Parameters<typeof countOpportunities>[0]
    );

    expect(result).toBe(2);
  });
});

describe('getViableOpportunities', () => {
  it('should filter for VIABLE status and RANKED/PUBLISHED state', async () => {
    const mockClient = createMockClient([mockViableRow]);
    mockClient._queryBuilder.then = undefined as unknown as never;
    const selectPromise = Promise.resolve({ data: [mockViableRow], error: null });
    vi.spyOn(mockClient._queryBuilder, 'limit').mockReturnValue(selectPromise as unknown as ReturnType<typeof mockClient._queryBuilder.limit>);

    const result = await getViableOpportunities(
      mockClient as unknown as Parameters<typeof getViableOpportunities>[0]
    );

    expect(mockClient._queryBuilder.eq).toHaveBeenCalledWith('status', 'VIABLE');
    expect(mockClient._queryBuilder.in).toHaveBeenCalledWith('workflow_state', ['RANKED', 'PUBLISHED']);
    expect(result[0].status).toBe('VIABLE');
  });
});
