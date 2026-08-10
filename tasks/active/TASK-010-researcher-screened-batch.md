# TASK-010: Researcher batch — screened properties

**Status:** BACKLOG  
**Assignee:** Researcher  
**Priority:** P0

## Description

Build evidence files for properties currently in `SCREENED` state with `scout_decision: RESEARCH`. These candidates have passed Scout's gross yield screen and need verified financial data before underwriting.

## Candidates

As of 2026-08-10, the following properties are ready for research:

| Property ID | Location | Gross Yield | HOA | Notes |
|-------------|----------|-------------|-----|-------|
| `225-celebration-pl-unit-526-celebration-fl` | Celebration, FL | 20.7% | $1,242/mo | Melia condo-hotel; verify STR income model |
| `9860-s-thomas-dr-unit-917-panama-city-beach-fl` | Panama City Beach, FL | 19% | $660/mo | Laketown Wharf; listing claims $53K STR gross 2025 |
| `17462-front-beach-rd-unit-31c-panama-city-beach-fl` | Panama City Beach, FL | 15.5% | $630/mo | Horizon South IV; verify rental history |

## Instructions

For each property:

1. **Read existing** `data/properties/{id}/meta.json` for Scout notes and rent sources.

2. **Create** `data/properties/{id}/evidence.json` with all required fields per `schemas/property-evidence.json`:
   - `purchase_price` (from listing)
   - `monthly_rent` (verify or upgrade Scout estimate)
   - `hoa_monthly` (verify from HOA docs, estoppel, or listing)
   - `special_assessments` (research; mark UNKNOWN if no evidence found)
   - `property_taxes_annual`
   - `insurance_annual` (estimate from comps if needed)
   - `management_annual` (typical STR: 20–30%; LTR: 8–10%)
   - `utilities_annual` (owner-paid)
   - `other_expenses_annual`
   - `rental_restrictions`
   - `str_restrictions`

3. **Every field** must include `value`, `status`, `confidence`, `source`, `evidence` per `docs/ARCHITECTURE.md`.

4. **Update** `meta.json`:
   - Set `workflow_state: "RESEARCHING"` when you start
   - Set `workflow_state: "READY_FOR_UNDERWRITING"` when evidence is complete

5. **Flag unknowns** conservatively:
   - Unknown HOA or assessment → max WATCHLIST (Underwriter rule)
   - STR revenue claims → verify via management company, AirDNA, or documented history

## Priority guidance

| Property | Priority | Rationale |
|----------|----------|-----------|
| 9860 S Thomas Dr | 1 | Documented $53K STR gross; highest confidence if verified |
| 17462 Front Beach Rd | 2 | Rental history claimed; moderate confidence |
| 225 Celebration Pl | 3 | Condo-hotel model adds complexity; high HOA |

## Acceptance criteria

- [ ] All 3 properties have complete `evidence.json`
- [ ] Each financial field has source and evidence
- [ ] `meta.json` updated to `READY_FOR_UNDERWRITING`
- [ ] Unknown or unverifiable fields marked appropriately
- [ ] Commit one property at a time or in logical batches

## Depends on

- `schemas/property-evidence.json`
- Scout output in `meta.json`

## Notes

Panama City Beach properties are now in active markets (added 2026-08-10). Celebration FL is in WATCH status due to condo-hotel complexity. Research all 3 properties; prioritize PCB where confidence is higher.

## Manager triage (2026-08-10)

**Coordination with TASK-009 (Scout volume sweep):**
- Scout should continue searching while Researcher works these 3 candidates
- New SCREENED candidates from TASK-009 will be added to a future Researcher batch
- Prioritize completing evidence files for high-confidence PCB properties first

**Pipeline state:**
- 3 properties in SCREENED state awaiting research
- 0 properties in RESEARCHING or later states
- Goal: move at least 1 property to READY_FOR_UNDERWRITING to validate full pipeline
