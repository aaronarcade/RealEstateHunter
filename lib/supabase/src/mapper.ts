import type { PropertyOpportunity, FieldValue, PropertyRow } from './types.js';

export function rowToOpportunity(row: PropertyRow): PropertyOpportunity {
  return {
    id: row.id,
    address: row.address,
    location: row.location,
    listingUrl: row.listing_url,
    purchasePrice: row.purchase_price,
    monthlyRent: row.monthly_rent,
    annualGrossRent: row.annual_gross_rent,
    annualOperatingExpenses: row.annual_operating_expenses,
    noi: row.noi,
    capRate: row.cap_rate,
    hoa: row.hoa,
    assessment: row.assessment,
    confidence: row.confidence,
    status: row.status,
    sources: row.sources,
    rankedAt: row.ranked_at,
  };
}

export function opportunityToRow(opportunity: PropertyOpportunity, workflowState: string = 'PUBLISHED'): PropertyRow {
  return {
    id: opportunity.id,
    address: opportunity.address,
    location: opportunity.location,
    listing_url: opportunity.listingUrl,
    purchase_price: opportunity.purchasePrice,
    monthly_rent: opportunity.monthlyRent,
    annual_gross_rent: opportunity.annualGrossRent,
    annual_operating_expenses: opportunity.annualOperatingExpenses,
    noi: opportunity.noi,
    cap_rate: opportunity.capRate,
    hoa: opportunity.hoa,
    assessment: opportunity.assessment,
    confidence: opportunity.confidence,
    status: opportunity.status,
    workflow_state: workflowState,
    sources: opportunity.sources,
    ranked_at: opportunity.rankedAt,
  };
}

export function deriveConfidence(
  purchasePrice: FieldValue | undefined,
  monthlyRent: FieldValue | undefined,
  hoa: FieldValue | undefined
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'] as const;
  const values = [purchasePrice?.confidence, monthlyRent?.confidence, hoa?.confidence].filter(Boolean) as Array<'HIGH' | 'MEDIUM' | 'LOW'>;
  
  if (values.length === 0) return 'LOW';
  
  let minIndex = 0;
  for (const value of values) {
    const index = confidenceLevels.indexOf(value);
    if (index > minIndex) minIndex = index;
  }
  
  return confidenceLevels[minIndex];
}

export function deriveSources(
  purchasePrice: FieldValue | undefined,
  monthlyRent: FieldValue | undefined,
  hoa: FieldValue | undefined
): Array<{ label?: string; url?: string }> {
  const sources: Array<{ label?: string; url?: string }> = [];
  const seen = new Set<string>();
  
  const fields = [
    { field: purchasePrice, label: 'Purchase Price' },
    { field: monthlyRent, label: 'Monthly Rent' },
    { field: hoa, label: 'HOA' },
  ];
  
  for (const { field, label } of fields) {
    if (field?.source && !seen.has(field.source)) {
      seen.add(field.source);
      const isUrl = field.source.startsWith('http://') || field.source.startsWith('https://');
      sources.push({
        label: isUrl ? label : field.source,
        url: isUrl ? field.source : undefined,
      });
    }
  }
  
  return sources;
}
