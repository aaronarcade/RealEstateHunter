# TASK-014: Auditor review — REJECTED Laketown Wharf (9860 S Thomas Dr)

**Status:** ACTIVE  
**Assignee:** Builder (validation / task closeout; Auditor artifacts already on `main`)  
**Priority:** P1

## Description

Review the underwriting analysis for `9860-s-thomas-dr-unit-917-panama-city-beach-fl` (Laketown Wharf Unit 917) which has been proposed as **REJECTED** with a 9.0% base-case cap rate (below the 10% threshold).

## Property Details

| Field | Value |
|-------|-------|
| Address | 9860 S Thomas Dr Unit 917, Panama City Beach, FL 32408 |
| Market | Panama City Beach, FL (ACTIVE) |
| Building | Laketown Wharf |
| Property ID | `9860-s-thomas-dr-unit-917-panama-city-beach-fl` |
| Workflow State | UNDERWRITTEN → AUDIT → ARCHIVED |
| Proposed Status | **REJECTED** |
| Cap Rate | 9.0% (base case) |

## Underwriting Summary

| Metric | Value |
|--------|-------|
| Purchase Price | $279,000 (VERIFIED, HIGH confidence) |
| Monthly Rent | $4,417 (VERIFIED, HIGH — documented $53K STR gross 2025) |
| HOA Monthly | $660 (ESTIMATED, MEDIUM confidence) |
| Annual Gross Rent | $53,000 |
| Annual Operating Expenses | $27,920 |
| NOI | $25,080 |
| Cap Rate | **9.0%** |

### Sensitivity Analysis

| Case | Rent | Management | Cap Rate |
|------|------|------------|----------|
| Base | $53,000/yr | 20% | 9.0% |
| Optimistic rent | $57,600/yr | 20% | 10.3% |
| Low management (15%) | $53,000/yr | 15% | 9.9% |
| Self-managed | $53,000/yr | 0% | 12.8% |

### Risk Factors

1. Special assessments UNKNOWN (LOW confidence) — 2008 building; estoppel required
2. HOA ESTIMATED from comparable unit 913 — verify via estoppel
3. STR management (20% of gross = $10,600/yr) is major expense driver
4. Documented $53K gross is actual 2025 performance but STR income is variable

## Auditor Instructions

Per `docs/PRODUCT.md` and `docs/ARCHITECTURE.md`:

1. **Review evidence file** at `data/properties/9860-s-thomas-dr-unit-917-panama-city-beach-fl/evidence.json`
2. **Review underwriting file** at `data/properties/9860-s-thomas-dr-unit-917-panama-city-beach-fl/underwriting.json`
3. **Validate rejection rationale** — is 9.0% base-case cap rate a justified REJECTED classification?
4. **Check for missing evidence** — could UNKNOWN assessments or HOA estimate change outcome to WATCHLIST?
5. **Document findings** in `audit.json`

### Audit Decision Options

| Result | When to Use |
|--------|-------------|
| `PASS` | Rejection analysis is correct and complete |
| `NEEDS_RESEARCH` | Missing evidence (estoppel, assessments) that could materially change outcome |
| `DOWNGRADE` | Not applicable (already REJECTED) |

## Expected Outcome

Given the 9.0% base-case cap rate (below 10% threshold) with standard 20% STR management, **PASS is expected** for the REJECTED classification. Consider NEEDS_RESEARCH only if estoppel would confirm materially lower HOA or assessments that push cap rate above 10%.

## Output

Create `data/properties/9860-s-thomas-dr-unit-917-panama-city-beach-fl/audit.json`, then update `meta.json`:

- If PASS on REJECTED: set `workflow_state: "ARCHIVED"`, `rescreen_after` per policy (60 days for diligence reject)
- If NEEDS_RESEARCH: set `workflow_state: "RESEARCHING"` with specific gaps listed

## Acceptance Criteria

- [x] Evidence file reviewed and validated
- [x] Underwriting calculations verified
- [x] `audit.json` created with result and findings
- [x] `meta.json` updated per audit outcome (ARCHIVED, 60-day rescreen)
- [ ] Schema validation tests for Laketown Wharf audit artifacts
- [ ] Commit and open PR on Builder branch

## Depends on

- TASK-012 (Analyst US pipeline batch — complete)

## Notes

This is the highest-confidence rent estimate in the US pipeline (documented actual STR gross). Rejection at 9.0% confirms that gross yield screening alone is insufficient — operating expenses (HOA + management) compress returns below threshold. Scout should continue scanning Laketown Wharf sibling units for better price points.

Auditor PASS and Manager archive landed on `main` (commits `567625b`, `919b276`). Builder closeout adds regression tests and moves this task to done.
