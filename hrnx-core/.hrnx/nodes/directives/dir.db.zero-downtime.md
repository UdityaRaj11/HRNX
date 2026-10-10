---
id: dir.db.zero-downtime
title: Zero-Downtime Database Migrations
type: directive
severity: fatal_invariant
status: active
implements:
  - ADR-001
validated_by:
  - eval.db.prevent-drop
rationale: "Prevents accidental data loss and table locking during agent-assisted database refactoring"
targets:
  claude:
    enabled: true
  cursor:
    globs: ["migrations/**/*.sql", "prisma/**/*.prisma"]
---

# Zero-Downtime Database Migrations

AI agents must never generate destructive DDL operations without multi-phase migration steps.

## Invariant Rules
1. `DROP TABLE` and `DROP COLUMN` are strictly prohibited.
2. New columns must be added as `NULLABLE` or have explicit default values.
3. Adding indexes on large tables must use `CONCURRENTLY` (PostgreSQL).
