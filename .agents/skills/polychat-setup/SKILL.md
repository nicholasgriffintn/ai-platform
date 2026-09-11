---
name: polychat-setup
description: Configure, deploy, and verify Polychat using the live repository and SKILL/AGENTS context.
---

# Polychat setup

Use the repository as implementation authority. If a request includes deploy, migrations, or external connectors, pause and confirm credentials first.

## Core references

- [Understand product and workflow](references/product.md)
- [Set up local development](references/setup.md)
- [Apply runtime configuration](references/configuration.md)
- [Deploy safely](references/deployment.md)
- [White-label and branding](references/white-labelling.md)
- [Architecture context and ownership](references/architecture/context.md)
- [Durable decisions](references/architecture/decisions.md)
- [Model catalogue](references/operations/model-catalogue.md)
- [Billing and spend](references/operations/loop-cost-controls.md)
- [Connector operations](references/operations/composio-connectors.md)

## Operating rules

- Keep scope narrow and report unresolved external actions in `references/verification.md`.
- Prefer optional worker details only when the task explicitly touches sandbox, training or local runtime setup.
- Never invent identifiers or credentials, and never paste ignored secrets into tracked files.
- Treat `setup` as local unless the user authorises a deployment action.

### Validation points

- [E2E guide](references/testing/e2e.md) for app/API/Worker coverage.
- `.agents/verification` items for operator-only checks.
- [architecture decisions](references/architecture/decisions.md) when changing durable boundaries.
