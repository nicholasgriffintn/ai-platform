---
name: polychat-setup
description: Set up, configure, understand and release Polychat from the current repository.
---

# Polychat setup

Use the checked-out code and manifests as the source of truth. Read only the guide that matches the task, and verify paths, commands and bindings before repeating them.

## Guides

- **Product and architecture:** [product](references/product.md), [architecture map](references/architecture/context.md), [decision records](references/architecture/decisions/).
- **Local development:** [setup](references/setup.md), [configuration](references/configuration.md), [E2E checks](../../../apps/app/tests/e2e/README.md).
- **Deployment and release:** [deployment](references/deployment.md), [release process](references/operations/releases.md), [verification records](references/verification.md).
- **Model operations:** [catalogue](references/operations/model-catalogue.md), [model platform](references/operations/model-governance.md), [usage and cost](references/operations/loop-cost-controls.md), [Stripe](references/operations/stripe-billing.md).
- **Capabilities and workers:** [Composio](references/operations/composio-connectors.md), [computer use](references/operations/computer-use.md), [OCR](references/operations/ocr.md), [agent gateways](references/operations/agent-gateways.md), [sandbox worker](references/components/sandbox-worker.md).
- **Branding:** [white-labelling](references/white-labelling.md).

## Working rules

- Local setup stays local. Deployments and remote migrations need explicit user authority.
- Use tracked manifests and example files; keep credentials out of tracked files and model input.
- Keep operational guidance short and point to the owning package or application for implementation details.
- Record only outstanding operator checks in `.agents/verification/pending/`; skip verification records for documentation-only changes.
- Follow the repository root `AGENTS.md` and the owning package's README.
