# Microagent: Execute Phased Database Migration
Triggers: migrate database, apply schema changes

# Execute Phased Database Migration

Procedural workflow for verifying and staging non-destructive database migrations.

## Steps
1. Inspect pending migration files for non-destructive operations (ref: @dir.db.zero-downtime).
2. Execute dry-run schema validation via `@tool.db.psql-executor`.
3. Check table lock times and verify rollback procedures.