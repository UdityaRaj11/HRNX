---
id: tool.db.psql-executor
title: PostgreSQL Schema Verification Executor
type: tool
provider: bash
command: "psql -U test -d sandbox --dry-run < $SQL_FILE"
read_only: true
permissions:
  - read-only
  - sandbox-db
---

# PostgreSQL Schema Verification Executor

Safely executes SQL migration scripts against an ephemeral read-only test sandbox.
