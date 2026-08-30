# Issue #44 — MST Scores / BetFlow separation handoff

## Scope

- Branch: `codex/issue-44-mst-betflow-separation-2026-08-31`
- PR: #28
- Environment: source/validation only
- Production actions: **NONE**

## State

MST Scores already uses the MST-owned API origin `https://app-api.myanmarsportstalk.com`. No runtime endpoint migration is required in this repository for Issue #44.

## Changes

- Added a binding root `AGENTS.md` product boundary.
- Added `scripts/validate-product-separation.js`.
- Wired the guard into `validate:shared-backend` so normal backend validation fails if active BetFlow product references are introduced.
- Preserved current MST Scores functionality and MST-owned origins.

## Merge gate

1. Separation validation passes on the PR head.
2. Existing backend/app validation remains green.
3. No production mutation or endpoint change is introduced.
