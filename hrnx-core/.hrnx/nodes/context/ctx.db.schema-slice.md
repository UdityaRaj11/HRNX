---
id: ctx.db.schema-slice
title: Database Models and Migration Context
type: context_slice
globs:
  - "src/models/**/*.py"
  - "migrations/**/*.sql"
priority: 85
budget_tokens: 4000
---

# Database Models Context Slice

Restricts agent token budget to relevant schema models and migration history.
