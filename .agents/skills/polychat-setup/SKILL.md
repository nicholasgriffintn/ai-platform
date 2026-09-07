---
name: polychat-setup
description: Configure, self-host, deploy or rebrand Polychat; explain its architecture and maintain release verification. Use for repository setup and durable product decisions.
---

# Polychat setup

Use current code, package scripts, example environment files and Wrangler manifests as the implementation authority. Default to web and API; add optional components only when needed. Ask for missing decisions or credentials, not facts already in the repository. Follow existing user authorisation and the root engineering contract in `AGENTS.md`.

Read only the guides relevant to the task:

- Orientation and product behaviour: [product](references/product.md).
- Local development and iOS: [setup](references/setup.md).
- Bindings, providers and secrets: [configuration](references/configuration.md).
- Production rollout: [deployment](references/deployment.md).
- Rebranding: [white-labelling](references/white-labelling.md).
- Optional Workers: [sandbox](references/components/sandbox-worker.md), [training](references/components/training-worker.md).
- Operations: [releases](references/operations/releases.md), [connectors](references/operations/composio-connectors.md), [billing](references/operations/stripe-billing.md), [usage](references/operations/loop-cost-controls.md), [model catalogue](references/operations/model-catalogue.md), [streaming](references/operations/streaming-responsiveness.md), [OCR](references/operations/ocr.md), [agent gateways](references/operations/agent-gateways.md).
- Architecture: [context](references/architecture/context.md) for current ownership, and the relevant [decision](references/architecture/decisions.md) for rationale.
- Validation: [E2E](references/testing/e2e.md) and [human verification](references/verification.md).

Configure and validate the selected scope, then report unresolved external actions. Never invent identifiers or credentials, copy ignored secrets into tracked files, or treat a setup request as permission to deploy or migrate remotely. Rebranding includes callbacks, cookies, origins, signing and service bindings as well as visible identity.

Maintain one home for each subject: procedures in these guides, current vocabulary and module ownership in context, durable trade-offs in a decision record. Record human verification only when static checks cannot establish the changed behaviour.
