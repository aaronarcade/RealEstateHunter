# TASK-002: Opportunity comparison UI

**Status:** DONE  
**Assignee:** Builder  
**Priority:** P1  
**Completed:** 2026-08-10

## Description

Build the primary interface for comparing ranked property opportunities. Display fields defined in `docs/PRODUCT.md` and the `PropertyOpportunity` contract in `docs/ARCHITECTURE.md`.

## Acceptance criteria

- [x] Table or card view showing: property, location, price, rent, NOI, cap rate, HOA, assessments, confidence, status, listing link
- [x] Sort by status, confidence, cap rate, NOI (per ranking rules)
- [x] Visual distinction for VIABLE / WATCHLIST / REJECTED
- [x] Reads from published/ranked property data

## Dependencies

- TASK-001 (property schema helpers) - needed for data layer
- Pipeline must have RANKED properties to display

## Notes

UI agent should render pipeline output, not make investment judgments.

## Implementation

Created `ui/` React application with:
- `OpportunityTable` component for tabular view with sortable columns
- `OpportunityCard` component for card-based view
- `StatusBadge` and `ConfidenceBadge` for visual status distinction
- Sorting utilities implementing PRODUCT.md ranking rules (status > confidence > cap rate > NOI)
- Data loader for fetching published property data
- Sample data for development
- 45 unit tests covering all components and utilities
