# RealEstateHunter

Role-based agentic workflow for finding credible rental investment opportunities with **≥10% unlevered cap rate**.

## How It Works

Six specialized agents operate against shared artifacts in this repo:

```
                     MANAGER
                        │
                        ▼
                      SCOUT
                        │
                 promising only
                        ▼
                   RESEARCHER
                        │
                        ▼
                   UNDERWRITER
                        │
                        ▼
                     AUDITOR
                    /       \
                  FAIL      PASS
                   │          │
                   ▼          ▼
              RESEARCHER    MANAGER
                              │
                              ▼
                         ranked output

                   BUILDER ── maintains the whole system
```

| Agent | Question it answers |
|-------|---------------------|
| **Manager** | What should we investigate? |
| **Scout** | Is this worth investigating? |
| **Researcher** | What are the actual facts? |
| **Underwriter** | What do the numbers say? |
| **Auditor** | Can we trust those numbers? |
| **Builder** | Does the system actually work? |

## Repository Layout

```
├── AGENTS.md                 # Agent constitution (read first)
├── data/
│   ├── search-criteria.json  # Manager-owned markets, filters, scout rules
│   ├── properties/           # Property evidence and analysis records
│   └── orchestrator/         # Agent spawn registry
├── docs/                     # PRODUCT, ARCHITECTURE, ORCHESTRATOR, DECISIONS
├── .agents/                  # Role-specific prompts
├── .cursor/agents/           # Cursor subagent delegation
├── lib/property/             # Property record CRUD + schema validation
├── orchestrator/             # Pipeline orchestrator (spawns Cloud Agents)
├── schemas/                  # JSON schemas for all artifacts
├── scripts/                  # Root-level validate script
├── tasks/                    # backlog / active / done
└── ui/                       # Opportunity comparison UI (Vite + React)
```

## Search criteria

Scout and Manager use **[data/search-criteria.json](data/search-criteria.json)** for:

- Active target markets (priority order)
- Property types, price range, exclusions
- Scout gross-yield threshold (`target_yield_minimum`, currently 12%)
- Underwriting target (`target_cap_rate`, 10%)

Schema: [schemas/search-criteria.json](schemas/search-criteria.json). Config reference: `orchestrator.config.json` → `manager.scanCriteriaFile`.

## Pipeline orchestrator

The **orchestrator** scans repo state and spawns Cursor Cloud Agents for the next required roles.

- Docs: [docs/ORCHESTRATOR.md](docs/ORCHESTRATOR.md)
- Config: [orchestrator.config.json](orchestrator.config.json)
- Schedule: [.github/workflows/orchestrator.yml](.github/workflows/orchestrator.yml) (daily + manual dispatch)
- Requires GitHub secret: `CURSOR_API_KEY`

```bash
cd orchestrator && npm ci && npm run build
npm run plan -- --repo-root ..          # preview
npm run run -- --repo-root .. --dry-run # preview spawns
npm run run -- --repo-root ..           # spawn agents
```

## Getting Started

1. Read `AGENTS.md` and `docs/PRODUCT.md`.
2. Review `data/search-criteria.json` before Scout work.
3. Pick a role from `.agents/`.
4. For implementation work, take a task from `tasks/backlog/` into `tasks/active/` on its own branch/worktree.
5. Property candidates flow through the state machine in `docs/ARCHITECTURE.md`.

## Development

### Property schema validation (repo root)

Validates artifacts under `data/properties/` against JSON schemas. Requires Node.js ≥ 20.

```bash
npm ci
npm run validate   # validate property artifacts
npm test           # schema validation test suite
```

### Property library

```bash
cd lib/property && npm ci && npm test
```

### Opportunity UI

```bash
cd ui && npm ci && npm run dev
```

See [ui/README.md](ui/README.md) for UI details.

## Investment Standard (Summary)

- **VIABLE**: cap rate ≥ 10% with sufficiently verified inputs
- **WATCHLIST**: potentially ≥ 10%, but material uncertainty remains
- **REJECTED**: cap rate < 10% or known costs make the opportunity unattractive

See [docs/PRODUCT.md](docs/PRODUCT.md) for the full underwriting standard.
