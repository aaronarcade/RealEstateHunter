# Architectural Decisions

Log of significant technical and process decisions. Add a new entry when introducing dependencies, changing schemas, or altering agent boundaries.

---

## ADR-001: Six-role agent model

**Date:** 2026-08-09  
**Status:** Accepted

**Context:** Need a multi-agent workflow for finding rental investments with ≥10% unlevered cap rate without excessive communication overhead.

**Decision:** Use six roles — Manager, Scout, Researcher, Underwriter, Auditor, Builder — collapsing Planner/Orchestrator/Ranker into Manager and Property Researcher/Rent Analyst/Expense Analyst into Researcher.

**Consequences:** Each role has a focused prompt in `.agents/`. Split roles only if a bottleneck emerges.

---

## ADR-002: Git artifacts as agent communication

**Date:** 2026-08-09  
**Status:** Accepted

**Context:** Shared chat history between agents creates drift and duplicated work.

**Decision:** Agents communicate through repo artifacts: tasks, property records under `data/properties/`, and docs. Use isolated git worktrees for parallel implementation.

**Consequences:** All agents must read/write structured files. Orchestrator (Manager or future automation) advances workflow by moving/updating artifacts.

---

## ADR-003: Auditor cannot upgrade to VIABLE

**Date:** 2026-08-09  
**Status:** Accepted

**Context:** Need a skeptical gatekeeper without creating optimistic bias.

**Decision:** Auditor validates or downgrades classifications only. Upgrading to VIABLE requires Researcher + Underwriter cycle, then Auditor approval.

**Consequences:** False negatives are corrected by sending properties back to Researcher; false positives are blocked at audit.

---

## ADR-004: UNKNOWN is a valid field status

**Date:** 2026-08-09  
**Status:** Accepted

**Context:** Agents may infer zero for missing HOA or assessments, producing false VIABLE classifications.

**Decision:** Researcher and Expense logic must use `UNKNOWN` when evidence is absent. Never infer zero without documentation.

**Consequences:** Properties with unknown material costs cap at WATCHLIST unless strong evidence shows the cost does not apply.

---

## ADR-005: Supabase as UI data store, Git as agent artifacts

**Date:** 2026-08-10  
**Status:** Accepted

**Context:** UIs need queryable, low-latency access to property data. Git JSON files are the source of truth for agent workflow but are unsuitable for direct UI queries. Aaron has an existing Supabase project at `https://quvfkegqgbrvtmufndpn.supabase.co`.

**Decision:** Use a two-layer architecture:
- **Git JSON** (`data/properties/`) remains the agent workflow artifact layer for handoffs, PR review, and audit trail
- **Supabase** stores the queryable copy for UIs and dashboards
- **One-way sync** (Git → Supabase) runs when properties reach `RANKED`/`PUBLISHED` or audit `PASS`

Read clients in TypeScript (`lib/supabase/`) and Python (`lib/supabase_py/`) provide `listOpportunities()` and `getProperty(id)` functions mapping to the `PropertyOpportunity` schema.

**Consequences:**
- UIs get fast, filterable queries without parsing Git files
- Agents continue using Git artifacts; no change to workflow
- Sync script must run on publish (GitHub Action or manual)
- Service role key must remain server-side only
- Schema changes require both JSON schema and Supabase migration updates

---

## Template

```markdown
## ADR-NNN: Title

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Superseded

**Context:** ...

**Decision:** ...

**Consequences:** ...
```
