# Example property record

This directory demonstrates the artifact structure agents produce. Do not treat as a real investment analysis.

## Files

| File | Owner | Purpose |
|------|-------|---------|
| `meta.json` | Scout → Manager | Workflow state and listing metadata |
| `evidence.json` | Analyst | Sourced factual record |
| `underwriting.json` | Analyst | NOI and cap rate calculation |
| `audit.json` | Auditor | Validation result |

## Workflow progression

```
SCREENED → RESEARCHING → UNDERWRITTEN → AUDIT → RANKED
```

This example is frozen at `AUDIT` with a PASS result for documentation purposes.
