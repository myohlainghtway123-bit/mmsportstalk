# MST Scores Agent Contract

This repository is an MST product repository. GitHub is the durable source of truth for non-trivial work.

## Product boundary

MST and Betflow are separate products and separate business systems.

Active MST Scores source, API origins, app defaults, tests, examples, secrets metadata, and current documentation must not use Betflow identity, domains, APIs, secrets, data, or product naming.

Do not normalize a conflicting legacy value because it works or because it is staging-only.

MST Scores currently uses MST-owned origins under `myanmarsportstalk.com`; preserve that boundary.

Historical agent-run evidence may retain old values only when clearly historical. New active code/config may not.

## GitHub-first and safety

Use a task branch, commits, PR, tests/evidence, and a durable handoff for non-trivial changes. Staging is the default. Never touch production without explicit owner approval, and never weaken security or architecture contracts to make tests pass.
