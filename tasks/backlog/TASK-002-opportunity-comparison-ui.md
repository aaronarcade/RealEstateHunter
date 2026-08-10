# TASK-002: Opportunity comparison UI

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P2

## Description

Build the primary interface for comparing ranked property opportunities. Display fields defined in `docs/PRODUCT.md` and the `PropertyOpportunity` contract in `docs/ARCHITECTURE.md`.

## Acceptance criteria

- [ ] Table or card view showing: property, location, price, rent, NOI, cap rate, HOA, assessments, confidence, status, listing link
- [ ] Sort by status, confidence, cap rate, NOI (per ranking rules)
- [ ] Visual distinction for VIABLE / WATCHLIST / REJECTED
- [ ] Reads from published/ranked property data

## Dependencies

- TASK-001 (property schema helpers) - needed for data layer
- Pipeline must have RANKED properties to display

## Notes

Deprioritized to P2 until pipeline produces ranked opportunities.
UI agent should render pipeline output, not make investment judgments.
