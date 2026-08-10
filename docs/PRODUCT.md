# Product Requirements

## Goal

Identify a small number of well-supported real estate investment opportunities suitable for rental use that are capable of producing an **unlevered cap rate of 10% or greater**.

Prioritize investment quality and confidence over the number of listings found.

## Objectives

### Find candidate properties

- Search for properties suitable for rental use.
- Focus on properties with a realistic path to a 10%+ unlevered cap rate.

### Verify critical investment inputs

A property can only be considered **VIABLE** when these are known or reasonably inferred with documented evidence:

- Purchase price
- Expected monthly rent
- HOA or condo fees
- Current or known special assessments

### Identify additional operating expenses

When available, determine:

- Property taxes
- Insurance
- Property management costs
- Owner-paid utilities
- Rental restrictions
- Short-term rental restrictions
- Other recurring owner-paid expenses

### Calculate investment performance

```
Annual Gross Rent     = Monthly Rent × 12
Annual Operating Expenses = HOA + assessments + property taxes + insurance
                          + management + owner-paid utilities + other recurring expenses
Annual NOI            = Annual Gross Rent − Annual Operating Expenses
Unlevered Cap Rate    = Annual NOI / Purchase Price
```

**Exclude** mortgage payments, financing costs, depreciation, income taxes, and appreciation.

### Evaluate data quality

For every estimated or inferred value:

- Record the source
- Mark it `VERIFIED`, `ESTIMATED`, or `UNKNOWN`
- Assign a confidence level (`HIGH`, `MEDIUM`, `LOW`)
- Explain material assumptions

### Handle unknown costs conservatively

- Never assume HOA or assessment fees are zero without evidence.
- Treat unverifiable material expenses as unknown.
- Do not classify a property as **VIABLE** when material costs remain unresolved unless strong evidence establishes that the cost does not apply.

## Classification

| Status | Criteria |
|--------|----------|
| **VIABLE** | Estimated cap rate ≥ 10% with sufficiently verified inputs |
| **WATCHLIST** | Potentially ≥ 10%, but material uncertainty remains |
| **REJECTED** | Estimated cap rate < 10% or known costs make the opportunity unattractive |

### VIABLE requirements

- Cap rate ≥ 10%
- Purchase price known
- Rent known
- HOA known
- Assessments known
- Material expenses sufficiently supported

## Output Requirements

### Primary interface fields

| Field | Description |
|-------|-------------|
| Property | Address or identifier |
| Location | City, state, etc. |
| Purchase price | Asking or expected purchase price |
| Monthly rent estimate | Expected monthly rent |
| Annual NOI | Net operating income |
| Cap rate | Unlevered cap rate |
| HOA | Monthly HOA |
| Assessment fees | Known or estimated special assessments |
| Confidence | Overall confidence in the analysis |
| Status | VIABLE / WATCHLIST / REJECTED |
| Listing link | Source URL |

### Ranking rules

Prioritize properties based on:

1. Status (VIABLE first)
2. Confidence in the analysis
3. Cap rate
4. Estimated annual cash generation (NOI)
5. Degree of unresolved uncertainty

When comparing two opportunities, prefer higher confidence over marginally higher cap rate (e.g., 11.8% HIGH confidence over 13.1% LOW confidence).

## Success Criteria

- High-confidence opportunities, not maximum listing count
- Every material financial input has a documented source and verification status
- Auditor has validated any **VIABLE** classification before it is published
