# TASK-012: Analyst batch — US pipeline properties

**Status:** BACKLOG  
**Assignee:** Analyst  
**Priority:** P0

## Description

Complete diligence and underwriting for US pipeline properties that have evidence files ready. Analyst produces both evidence updates (if gaps found) and `underwriting.json` in one run per current workflow.

## Manager triage (2026-08-11)

**US pipeline is the priority.** International properties in READY_FOR_UNDERWRITING are deprioritized until Scout meets US volume targets (see `data/pipeline-status.json`).

## Candidates

| Property ID | Location | Gross Yield | HOA | Rent Confidence | Priority |
|-------------|----------|-------------|-----|-----------------|----------|
| `9860-s-thomas-dr-unit-917-panama-city-beach-fl` | Panama City Beach, FL | 19% | $660/mo | **HIGH** (documented $53K STR) | **1** |
| `225-celebration-pl-unit-526-celebration-fl` | Celebration, FL | 20.7% | $1,242/mo | MEDIUM (condo-hotel) | 2 |

### Priority Rationale

**9860 S Thomas Dr — Laketown Wharf (Priority 1):**
- Documented actual STR income ($53,000 gross in 2025)
- Highest confidence rent estimate in the pipeline
- ACTIVE market (Panama City Beach)
- Best candidate to validate full pipeline beyond first REJECTED property

**225 Celebration Pl — Melia condo-hotel (Priority 2):**
- Condo-hotel model adds underwriting complexity
- $1,242/mo HOA is 83% of estimated rent
- Many UNKNOWN fields due to hotel management agreement opacity
- WATCH market (Celebration) — max WATCHLIST likely even if gross numbers pass

## Instructions

For each property:

1. **Read evidence file** at `data/properties/{id}/evidence.json`
2. **Fill any evidence gaps** discovered during diligence
3. **Calculate financials** per `docs/PRODUCT.md`
4. **Determine proposed status** (VIABLE / WATCHLIST / REJECTED)
5. **Create underwriting file** at `data/properties/{id}/underwriting.json`
6. **Update meta.json**: set `workflow_state: "UNDERWRITTEN"`

## Special Guidance

### 9860 S Thomas Dr (Laketown Wharf)

- Documented $53K STR gross → $4,417/mo rent (HIGH confidence)
- HOA $660/mo (MEDIUM confidence — verify via estoppel)
- Special assessments UNKNOWN — flag risk; max WATCHLIST unless verified none
- Standard STR operating model with 20% management assumption

### 225 Celebration Pl (Melia condo-hotel)

- Condo-hotel, not traditional STR — avoid double-counting HOA/management
- Consider **WATCHLIST** even if gross numbers suggest VIABLE
- Special assessments UNKNOWN — max WATCHLIST per PRODUCT.md

## Acceptance Criteria

- [ ] Both US properties have complete `underwriting.json`
- [ ] Calculations follow `docs/PRODUCT.md` formulas
- [ ] Proposed status justified with documented rationale
- [ ] Sensitivity analysis included
- [ ] `meta.json` updated to `UNDERWRITTEN`

## Depends on

- TASK-010 (evidence — complete for both properties)
- `schemas/property-underwriting.json`, `docs/PRODUCT.md`

## Blocks

- Auditor review tasks for each property after underwriting

## Notes

**Pipeline goal:** Move at least one US property to UNDERWRITTEN with potential VIABLE or WATCHLIST status.
