---
id: ADR-001
title: Zero-Downtime Database Migration Policy
type: adr
status: accepted
deciders:
  - platform-team@corp.internal
date: "2026-10-10"
---

# ADR-001: Zero-Downtime Database Migration Policy

## Context
Production databases must never experience locks or downtime during schema migrations.

## Decision
All schema migrations must follow expand/contract patterns. Destructive operations (DROP TABLE, DROP COLUMN) are forbidden in single-step releases.

## Consequences
Migrations require multi-phase rollouts. Agents must be governed by invariant directives.
