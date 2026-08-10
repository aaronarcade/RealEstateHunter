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
├── AGENTS.md              # Agent constitution (read first)
├── docs/
│   ├── PRODUCT.md         # Investment rules and objectives
│   ├── ARCHITECTURE.md    # Workflow, data schema, agent boundaries
│   └── DECISIONS.md       # Architectural decision log
├── .agents/               # Role-specific prompts
├── tasks/
│   ├── backlog/           # Proposed work
│   ├── active/            # In-progress work
│   └── done/              # Completed work
├── data/
│   └── properties/        # Property evidence and analysis records
└── schemas/               # JSON schemas for structured data
```

## Getting Started

1. Read `AGENTS.md` and `docs/PRODUCT.md`.
2. Pick a role from `.agents/`.
3. For implementation work, take a task from `tasks/backlog/` into `tasks/active/` on its own branch/worktree.
4. Property candidates flow through the state machine documented in `docs/ARCHITECTURE.md`.

## Development

Tooling for validating property artifacts against the JSON schemas in `schemas/`.
Requires Node.js ≥ 20 (provided by the Cloud Agent environment).

```bash
npm ci            # install dependencies (Ajv)
npm run validate  # validate every data/properties/<id>/ record against its schema
npm test          # run the schema-validation test suite
```

`npm run validate` discovers each `meta.json`, `evidence.json`, `underwriting.json`,
and `audit.json` under `data/properties/` and checks it against the matching schema,
exiting non-zero on any failure.

## Investment Standard (Summary)

- **VIABLE**: cap rate ≥ 10% with sufficiently verified inputs
- **WATCHLIST**: potentially ≥ 10%, but material uncertainty remains
- **REJECTED**: cap rate < 10% or known costs make the opportunity unattractive

See `docs/PRODUCT.md` for the full underwriting standard.
