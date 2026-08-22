# Architectural Decisions

Log of significant technical and process decisions. Add a new entry when introducing dependencies, changing schemas, or altering agent boundaries.

---

## ADR-001: Six-role agent model

**Date:** 2026-08-09  
**Status:** Superseded (partially by ADR-008)

**Context:** Need a multi-agent workflow for finding rental investments with ≥10% unlevered cap rate without excessive communication overhead.

**Decision:** Use six roles — Manager, Scout, Researcher, Underwriter, Auditor, Builder — collapsing Planner/Orchestrator/Ranker into Manager and Property Researcher/Rent Analyst/Expense Analyst into Researcher.

**Consequences:** Each role has a focused prompt in `.agents/`. Split roles only if a bottleneck emerges. Researcher + Underwriter merged into Analyst per ADR-008.

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

**Decision:** Auditor validates or downgrades classifications only. Upgrading to VIABLE requires Analyst output, then Auditor approval.

**Consequences:** False negatives are corrected by sending properties back to Analyst; false positives are blocked at audit.

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

## ADR-008: Merge Researcher and Underwriter into Analyst

**Date:** 2026-08-10  
**Status:** Accepted  
**Supersedes:** Partial scope of ADR-001 (Researcher + Underwriter split)

**Context:** Researcher and Underwriter ran as separate Cloud Agent spawns per property. Each incurred cold-start context, orchestrator round-trips, and PR merge latency. Underwriter work is lightweight math on evidence the Researcher already gathered.

**Decision:** Combine Researcher and Underwriter into a single **Analyst** role that produces both `evidence.json` and `underwriting.json` in one run (Phase 1 research, then Phase 2 underwriting with evidence locked). Keep **Scout** separate as the volume filter. Keep **Auditor** as the adversarial gate.

**Consequences:** Five agent roles (Manager, Scout, Analyst, Auditor, Builder). `READY_FOR_UNDERWRITING` remains valid for legacy properties but is no longer the normal completion state — Analyst sets `UNDERWRITTEN` directly. Orchestrator spawns Analyst instead of Researcher or Underwriter. Audit schema field `underwriter_proposed_status` is unchanged (historical name).

---

## ADR-009: Direct-to-main for property pipeline; PR auto-merge for Builder

**Date:** 2026-08-10  
**Status:** Accepted

**Context:** Each agent handoff required opening and manually merging a PR before the orchestrator could spawn the next role. That added hours of latency per property with no investment benefit — the Auditor is already the quality gate.

**Decision:**

1. **Property pipeline** (Manager, Scout, Analyst, Auditor): `roles.*.autoCreatePR: false` — Cloud Agents push JSON artifacts directly to `main`. Push triggers the orchestrator for that property.
2. **Builder**: keep feature branches + PRs. `.github/workflows/pull-request.yml` runs CI and enables GitHub auto-merge for `agent/` and `cursor/` branch PRs.
3. Per-role `autoCreatePR` and `skipReviewerRequest` overrides in `orchestrator.config.json`, falling back to global defaults.

**Consequences:** Faster property workflow (no PR wait between Scout → Analyst → Auditor → Manager). Builder code still goes through PR + CI. Concurrent property agents must scope edits to separate `data/properties/{id}/` paths to avoid push conflicts.

---

## ADR-010: Lightweight reviewed listings tier for scout volume

**Date:** 2026-08-10  
**Status:** Accepted

**Context:** Scout volume targets (40+ listings per market) require persisting many REJECT decisions for baseline analytics (cap rates, HOA, sqft) without creating full `data/properties/{id}/` artifact trees or syncing incomplete records into the heavy `properties` Supabase table (JSONB `FieldValue` blobs, underwritten fields).

**Decision:** Add a **reviewed listings** tier:

1. **Git:** `data/reviewed/listings.ndjson` — one flat `ReviewedListing` object per line, schema `schemas/reviewed-listing.json`.
2. **Supabase:** `reviewed_listings` table with flat columns (~10× smaller rows than `properties`).
3. **Scout workflow:** REJECT → append to NDJSON only; RESEARCH → full pipeline dir unchanged.
4. **UI:** Streamlit Browse → Reviewed page; sync via `scripts/sync-reviewed-to-supabase.mjs`.

**Consequences:** High-volume scout screening no longer creates ARCHIVED property dirs for rejects. Existing ARCHIVED meta records can be backfilled once via `scripts/backfill-reviewed-from-meta.mjs`. Estimated cap rate on reviewed listings is explicitly labeled as scout first-pass, distinct from underwritten cap rate on Opportunities.

---

## ADR-011: Backlog Assignee gate for Builder spawns

**Date:** 2026-08-20  
**Status:** Accepted

**Context:** `tasks/backlog/` holds both Builder implementation work and parked role-tracking tasks (Analyst batches, Scout sweeps). The orchestrator treated every backlog markdown file as a Builder spawn, which incorrectly launched Builder for TASK-016 (`Assignee: Analyst`) while zero US `SCREENED` properties existed.

**Decision:** `loadBuilderTasks` includes a backlog file only when `**Assignee:**` is absent (legacy default = Builder) or the assignee string contains `Builder` (case-insensitive). Analyst/Scout/Auditor/Manager-only assignees are skipped. Property workflow states continue to spawn those roles independently of task files.

**Consequences:** Manager can keep parked pipeline checklists in `tasks/backlog/` without burning Builder capacity. Builder agents only receive software tasks. Activate Analyst batch work by committing `SCREENED` property metas (or moving a Builder-assignee task into backlog when software work is needed).

---

## ADR-012: Scout market-sweep task planning and international defer

**Date:** 2026-08-22  
**Status:** Accepted

**Context:** TASK-009 (`Assignee: Scout`) lived in `tasks/active/` but the orchestrator only spawned Scout for property `CANDIDATE` / due `ARCHIVED` rescreens — never for market-sweep tasks. US Scout volume stalled (NDJSON unchanged; zero open US RESEARCH). Meanwhile Analyst/Auditor capacity was consumed on international properties Manager had parked.

**Decision:**

1. **Scout task planning:** Scan `tasks/active/` and `tasks/backlog/` for `**Assignee:** Scout`. Plan a Scout work item (`subjectType: task`, action `market-sweep`) pointing at the task file plus `data/search-criteria.json` and `data/pipeline-status.json`. Scout-assignee tasks are never routed to Builder (existing assignee gate).
2. **International defer:** When `defer_international_until_us_targets_met` is true and US ACTIVE markets have not met `research_candidates_per_market_min` (also inferred from `data/pipeline-status.json` gaps), skip Analyst/Auditor planning for properties whose `market_id` is outside US ACTIVE markets.

**Consequences:** Orchestrator autonomously spawns Scout for condo volume sweeps (TASK-009). Analyst/Auditor focus on US pipeline until volume targets are met. Scout property screening and market sweeps continue regardless of defer.

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
