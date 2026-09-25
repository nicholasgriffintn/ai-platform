# ADR 0062: Govern model versions, not model names

Status: Implemented in `modules/model-registry`, `library-model-registry` and `ai-model-sources`.

## Problem

Open models reach production through several hands, each working from a different record. A Hugging Face repository name is a moving target: the same `owner/name` can serve different weights, code and chat templates from one day to the next. The training catalogue named models by string and staged files from the repository head, so nothing tied a running endpoint to the commit anyone had looked at.

## Decision

The governed unit is a **version**: an asset (model or dataset) pinned to a Hub commit, with every file's size and LFS SHA-256 recorded at import. Import resolves any branch or tag to its commit before anything else happens. A version is never edited in place; a new upstream commit is a new version.

Approval is a **decision** about a version in a scope (workspace or project). Each decision stores the policy verdict it was made against, including every matched rule, the policy hashes and the IDs of the evidence it saw. Derived models (fine-tunes) and derived datasets (conversation exports) are versions too, joined by lineage edges, and pass through the same gate.

## Consequences

An auditor can answer "which weights, approved by whom, on what evidence" from one record, and the ML-BOM export is a projection of it. Imports cost a Hub metadata call and a tree listing up front. A repository that rewrites its history leaves old versions pointing at commits that may disappear upstream; ADR 0066 accepts that risk rather than copying weights.
