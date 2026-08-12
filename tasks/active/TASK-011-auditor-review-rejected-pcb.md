# TASK-011: Auditor review — REJECTED Panama City Beach property

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P1

## Description

Review the underwriting analysis for `17462-front-beach-rd-unit-31c-panama-city-beach-fl` which has been proposed as **REJECTED** with a 6.0% cap rate (below the 10% threshold).

## Property Details

| Field | Value |
|-------|-------|
| Address | 17462 Front Beach Rd Unit 31C, Panama City Beach, FL 32413 |
| Market | Panama City Beach, FL (ACTIVE market) |
| Property ID | `17462-front-beach-rd-unit-31c-panama-city-beach-fl` |
| Workflow State | UNDERWRITTEN |
| Proposed Status | **REJECTED** |
| Cap Rate | 6.0% (base case) |

## Underwriting Summary

| Metric | Value |
|--------|-------|
| Purchase Price | $249,900 (VERIFIED, HIGH confidence) |
| Monthly Rent | $3,200 (ESTIMATED, MEDIUM confidence) |
| HOA Monthly | $630 (VERIFIED, HIGH confidence) |
| Annual Gross Rent | $38,400 |
| Annual Operating Expenses | $23,404 |
| NOI | $14,996 |
| Cap Rate | **6.0%** |

### Sensitivity Analysis

| Case | Rent | Management | Cap Rate |
|------|------|------------|----------|
| Base | $3,200/mo | 20% | 6.0% |
| Optimistic | $4,000/mo | 20% | 8.3% |
| Self-managed + optimistic | $4,000/mo | 0% | 11.4% |

### Risk Factors

1. Special assessments UNKNOWN (LOW confidence) — 1983 building with recent permit activity
2. Highly seasonal rental market (25-35% winter occupancy)
3. HOA fee ($630/mo) exceeds $500 scrutiny threshold
4. Rent estimate relies on STR income with inherent variability

## Auditor Instructions

Per `docs/PRODUCT.md` and `docs/ARCHITECTURE.md`:

1. **Review evidence file** at `data/properties/17462-front-beach-rd-unit-31c-panama-city-beach-fl/evidence.json`
2. **Review underwriting file** at `data/properties/17462-front-beach-rd-unit-31c-panama-city-beach-fl/underwriting.json`
3. **Validate rejection rationale** — is 6.0% cap rate a justified REJECTED classification?
4. **Check for missing evidence** — any gaps that would change the outcome?
5. **Document findings** in `audit.json`

### Audit Decision Options

| Result | When to Use |
|--------|-------------|
| `PASS` | Rejection analysis is correct and complete |
| `NEEDS_RESEARCH` | Missing evidence that could materially change outcome |
| `DOWNGRADE` | Not applicable (already REJECTED) |

## Expected Outcome

Given the 6.0% cap rate (well below 10% threshold) and the sensitivity analysis showing only marginal viability under optimistic self-management assumptions, **PASS is expected** for the REJECTED classification.

## Output

Create `data/properties/17462-front-beach-rd-unit-31c-panama-city-beach-fl/audit.json`:

```json
{
  "result": "PASS",
  "final_status": "REJECTED",
  "findings": [...],
  "audited_at": "..."
}
```

Then update `meta.json`:
- Set `workflow_state: "ARCHIVED"`
- Set `rescreen_after` per policy (60 days for diligence reject)
- Add `archive_reason: "Cap rate 6.0% below 10% threshold"`

## Acceptance Criteria

- [x] Evidence file reviewed and validated
- [x] Underwriting calculations verified
- [x] `audit.json` created with result and findings
- [x] `meta.json` updated to ARCHIVED with rescreen policy
- [x] Validation tests added and passing
- [x] Commit and push

## Depends on

- TASK-010 (Researcher evidence — complete)
- Underwriting analysis (complete)

## Notes

This is the first property to complete the full pipeline through underwriting. Archive with 60-day rescreen per `data/search-criteria.json` rescreen policy for diligence rejects.
