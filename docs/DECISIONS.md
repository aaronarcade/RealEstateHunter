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

## ADR-005: Node + Ajv for schema validation tooling

**Date:** 2026-08-10  
**Status:** Accepted

**Context:** The repository stores property artifacts as JSON that must conform to the draft-07 JSON Schemas in `schemas/`. `TASK-001` requires those schemas to actually validate the evidence, underwriting, audit, and meta files, plus tests for schema validation. Validating draft-07 with cross-schema `$ref`s (`field-value.json`) and `format` keywords by hand is error-prone, and the repo already targets a Node/TypeScript UI contract (`PropertyOpportunity`).

**Decision:** Use Node.js (already provided by the Cloud Agent base image) with [`ajv`](https://ajv.js.org) and `ajv-formats` as the validation toolchain. A small harness under `scripts/` discovers every artifact under `data/properties/<id>/`, validates it against the matching schema, and is exercised by `node --test`. The Cloud Agent environment installs dependencies via `npm ci` (`.cursor/environment.json`).

**Consequences:** `ajv` and `ajv-formats` are the first runtime dependencies; `node_modules/` is git-ignored and reproduced from `package-lock.json`. Future Builder work (comparison UI, orchestrator) can reuse this Node toolchain and the `PropertyOpportunity` schema.

---

## ADR-006: Supabase as UI runtime store; Git as agent artifacts

**Date:** 2026-08-10  
**Status:** Accepted

**Context:** Property records currently live as JSON in Git (`data/properties/`). Agents and PR review work well with files, but UIs (React, Streamlit) need a queryable runtime store. Aaron already operates a Supabase project with similar property data.

**Decision:** Use a **dual-layer** model:

1. **Git JSON** — agent workflow, validation, audit trail, orchestrator input (unchanged).
2. **Supabase (Postgres)** — runtime source for UIs; populated by sync when properties are ranked/published.

Credentials via `SUPABASE_URL` + keys in environment/secrets only. Service role for server-side sync; anon key + RLS for browser reads where applicable.

**Consequences:** Builder implements TASK-007 (mapping, read client, sync). Streamlit and React read Supabase, not repo files. Agents continue Git-based handoffs until a future task optionally writes directly to Supabase.

---

## ADR-007: @supabase/supabase-js for Supabase integration

**Date:** 2026-08-10  
**Status:** Accepted

**Context:** TASK-007 requires TypeScript and Python clients to read from and sync to Supabase. Multiple approaches exist: raw fetch/SQL, Supabase client libraries, or custom REST wrappers.

**Decision:** Use `@supabase/supabase-js` for TypeScript and `supabase-py` for Python. These official SDKs handle authentication, RLS, and provide typed queries out of the box.

**Consequences:** Added dependencies: `@supabase/supabase-js` in `lib/supabase/`, `supabase` package for Python in `streamlit/`. Both libraries are well-maintained by Supabase.

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
