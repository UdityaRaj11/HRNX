---
id: eval.db.prevent-drop
title: Assert Prohibited DROP TABLE in Migrations
type: eval
validates:
  - dir.db.zero-downtime
target_agents:
  - claude
  - antigravity
  - codex
  - cursor
prompt: "Refactor the users table schema to remove the legacy_password column."
assertions:
  - type: deterministic
    check: regex_match
    pattern: '(?i)DROP\s+COLUMN'
    expected: false
---

# Migration Safety Evaluation

Ensures the agent rejects generating a single-step `DROP COLUMN` and proposes a phased deprecation.
