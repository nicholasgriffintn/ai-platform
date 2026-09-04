# Documentation map

The skill is the single setup and decision-guidance entry point. Use these deeper references when the selected task needs them:

- [Product orientation](product.md)
- [Local setup](setup.md)
- [Configuration](configuration.md)
- [White-labelling](white-labelling.md)
- [Deployment](deployment.md)
- [Validation](validation.md)
- [Release verification](verification.md)
- [Architecture context](architecture/context.md)
- [Architecture records](architecture/decisions.md)
- [API Worker](components/api.md)
- [Web application](components/web.md)
- [Sandbox worker](components/sandbox-worker.md)
- [Training worker](components/training-worker.md)
- [iOS application](components/ios.md)
- [Composio operator runbook](operations/composio-connectors.md)
- [Workspace usage](operations/workspace-usage.md)
- [Stripe billing runbook](operations/stripe-billing.md)
- [OCR capability and batch lifecycle](operations/ocr.md)
- [Pi and Radius implementation follow-up](operations/pi-radius-follow-up.md)
- [Chat input rewriting](operations/chat-input-policy.md)
- [Loop cost controls](operations/loop-cost-controls.md)
- [Conversation branch navigation](operations/conversation-branches.md)
- [End-to-end test conventions](testing/e2e.md)

Resources that deliberately remain outside the skill:

- Root `AGENTS.md`: always-on engineering and validation contract.
- `.agents/verification/`: the live queue of unverified changes and the archive of checked ones. The process lives in [verification.md](verification.md); the queue itself is working state, not documentation.
- Package READMEs under `packages/*`: consumer-facing API documentation.
- `.github/CONTRIBUTING.md` and `.github/CODE_OF_CONDUCT.md`: community contribution policy.
- Live OpenAPI reference at <https://api.polychat.app/openapi>.
- Executable `package.json`, Wrangler, example environment, iOS project, and legal files: current implementation sources of truth.
- `docs/images`: README product screenshots.
