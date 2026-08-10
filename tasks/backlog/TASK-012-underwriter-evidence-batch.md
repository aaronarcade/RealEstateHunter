# TASK-012: Underwriter batch — properties with evidence

**Status:** BACKLOG  
**Assignee:** Underwriter  
**Priority:** P0

## Description

Calculate NOI, cap rate, and proposed classification for properties that have completed evidence research. These candidates have evidence files ready for underwriting analysis.

## Candidates

As of 2026-08-10:

| Property ID | Location | Gross Yield | HOA | Rent Confidence | Priority |
|-------------|----------|-------------|-----|-----------------|----------|
| `9860-s-thomas-dr-unit-917-panama-city-beach-fl` | Panama City Beach, FL | 19% | $660/mo | **HIGH** (documented $53K STR) | **1** |
| `225-celebration-pl-unit-526-celebration-fl` | Celebration, FL | 20.7% | $1,242/mo | MEDIUM (condo-hotel) | 2 |

### Priority Rationale

**9860 S Thomas Dr (Priority 1):**
- Documented actual STR income ($53,000 gross in 2025)
- Highest confidence rent estimate
- Standard STR operating model
- ACTIVE market (Panama City Beach)

**225 Celebration Pl (Priority 2):**
- Condo-hotel model adds underwriting complexity
- $1,242/mo HOA is 83% of estimated rent
- Many UNKNOWN fields due to hotel management agreement opacity
- WATCH market (Celebration)

## Instructions

For each property:

1. **Read evidence file** at `data/properties/{id}/evidence.json`
2. **Calculate financials** per `docs/PRODUCT.md`:

```
Annual Gross Rent     = Monthly Rent × 12
Annual Operating Expenses = HOA + assessments + property taxes + insurance
                          + management + utilities + other recurring
Annual NOI            = Annual Gross Rent − Annual Operating Expenses
Unlevered Cap Rate    = Annual NOI / Purchase Price
```

3. **Determine proposed status**:

| Status | Criteria |
|--------|----------|
| **VIABLE** | Cap rate ≥ 10% with sufficiently verified inputs |
| **WATCHLIST** | Potentially ≥ 10% but material uncertainty remains |
| **REJECTED** | Cap rate < 10% or known costs make opportunity unattractive |

4. **Create underwriting file** at `data/properties/{id}/underwriting.json`:

```json
{
  "property_id": "...",
  "annual_gross_rent": ...,
  "annual_operating_expenses": ...,
  "operating_expense_breakdown": {
    "hoa": ...,
    "special_assessments": ...,
    "property_taxes": ...,
    "insurance": ...,
    "management": ...,
    "utilities": ...,
    "other": ...
  },
  "noi": ...,
  "cap_rate": ...,
  "proposed_status": "VIABLE" | "WATCHLIST" | "REJECTED",
  "proposed_status_reason": "...",
  "input_summary": {...},
  "sensitivity_analysis": {...},
  "risk_factors": [...],
  "computed_at": "..."
}
```

5. **Update meta.json**:
   - Set `workflow_state: "UNDERWRITTEN"`

## Special Guidance

### 9860 S Thomas Dr (Laketown Wharf)

- Documented $53K STR gross → $4,417/mo rent (HIGH confidence)
- HOA $660/mo (MEDIUM confidence — verify via estoppel)
- Special assessments UNKNOWN — flag risk
- Standard STR operating model with 20% management assumption

### 225 Celebration Pl (Melia condo-hotel)

**CRITICAL:** This is a condo-hotel, not a traditional STR.

- Revenue model may involve hotel management revenue sharing
- $1,242/mo HOA may include management services (avoid double-counting)
- Many fields marked UNKNOWN or LOW confidence
- Evidence notes indicate owners often break even
- Consider **WATCHLIST** even if gross numbers suggest VIABLE
- Condo-hotel complexity may warrant automatic WATCHLIST until management agreement terms are verified

## Acceptance Criteria

- [ ] Both properties have complete `underwriting.json`
- [ ] Calculations follow `docs/PRODUCT.md` formulas
- [ ] Proposed status justified with documented rationale
- [ ] Sensitivity analysis included
- [ ] Risk factors documented
- [ ] `meta.json` updated to `UNDERWRITTEN`
- [ ] Commit properties individually or in logical batch

## Depends on

- TASK-010 (Researcher evidence — complete)
- `schemas/property-underwriting.json`
- `docs/PRODUCT.md` (classification rules)

## Blocks

- TASK-011 style Auditor review tasks for each property

## Notes

**Pipeline goal:** Move at least one property to UNDERWRITTEN with potential VIABLE or WATCHLIST status to validate the full pipeline beyond the first REJECTED property.

Special assessments are UNKNOWN for both properties. Per `docs/ARCHITECTURE.md`:
> If assessment unknown: WATCHLIST at most unless evidence establishes none exists.

This limits maximum classification to WATCHLIST unless assessments can be verified.
