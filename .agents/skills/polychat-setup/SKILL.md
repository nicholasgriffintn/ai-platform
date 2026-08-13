---
name: polychat-setup
description: Guide and implement Polychat orientation, local setup, Cloudflare configuration, optional integrations, deployment, white-labelling, and architecture decisions. Use when someone wants to understand Polychat, configure or self-host this repository, choose which capabilities to run, rebrand a fork, or change a load-bearing product or technical decision.
---

# Polychat setup

Guide the user from intent to a working, validated Polychat configuration. Treat setup as a collaborative implementation: explain the next decision, recommend a default, incorporate feedback, make the agreed repository edits, and validate each completed stage.

## Start here

Read [product.md](references/product.md) before guiding a new adopter. Then read only the references required for the request:

- Local development: [setup.md](references/setup.md) and [configuration.md](references/configuration.md)
- White-labelling: [white-labelling.md](references/white-labelling.md)
- Cloudflare or production rollout: [deployment.md](references/deployment.md)
- Architecture or product decisions: [decisions.md](references/architecture/decisions.md), then the relevant accepted decision and [context.md](references/architecture/context.md)
- Validation: [validation.md](references/validation.md)
- Detailed component or operator behaviour: [documentation-map.md](references/documentation-map.md)

Read each selected reference completely before acting. Prefer current code, package scripts, example environment files, and deployment manifests over copied values in prose when they disagree.

## Guided workflow

1. **Establish the outcome.** Determine whether the user wants to explore Polychat, run it locally, deploy it, enable an optional capability, or create a white-labelled product. Ask only for decisions that cannot be learned from the repository.
2. **Recommend a scope.** Default to the web app and API. Add the sandbox worker, training worker, Composio, paid billing, external analytics, or iOS only when they serve the stated outcome.
3. **Explain the boundary.** Tell the user what the chosen component does, what external accounts or infrastructure it needs, and what can be deferred.
4. **Inspect before editing.** Confirm current scripts, example variables, Cloudflare bindings, hard-coded brand surfaces, and accepted decisions. Do not assume an old guide is current.
5. **Make one coherent stage at a time.** Present the recommended choice and trade-off, collect feedback when it materially changes the result, then make the agreed edits. Keep a short list of unresolved external actions.
6. **Validate continuously.** Run the narrowest meaningful static checks after each stage. Do not start development servers unless runtime behaviour requires it or the user explicitly asks.
7. **Hand off clearly.** Summarise what is configured, what remains external, what secrets the user still needs to set, commands validated, and residual risks.

## Decision rules

- Do not ask the user to choose facts already encoded in the repository.
- Do not invent secrets, Cloudflare identifiers, domains, OAuth credentials, Apple identifiers, or provider keys.
- Never copy values from ignored `.env` or `.dev.vars` files into chat, documentation, tests, or tracked files. Use example files as the variable-name authority.
- Treat production deploys, remote migrations, provider dashboard changes, domain changes, queue or bucket replacement, and signing changes as explicit external actions. Explain blast radius and obtain authority before executing them.
- Preserve secure defaults. White-labelling must cover auth callbacks, cookies, CORS/CSP, universal links, web credentials, webhooks, signing identity, email copy, and public metadata—not just visible names and logos.
- Keep `AGENTS.md` as the always-on engineering contract. This skill owns Polychat product context, setup guidance, and accepted architecture records.
- When a load-bearing term changes, update [context.md](references/architecture/context.md). When a decision is hard to reverse, surprising, and based on a real trade-off, add the next numbered record under `references/architecture/decisions/` and update [decisions.md](references/architecture/decisions.md).
- Do not duplicate instructions back into app-level READMEs. Update the appropriate skill reference when setup behaviour changes.

## Completion gate

Before claiming completion, confirm:

- The selected components and deferred capabilities are explicit.
- Tracked configuration contains no secrets.
- Brand and domain changes are consistent across chosen clients and services.
- Required schemas, bindings, migrations, callbacks, and external resources are accounted for.
- Relevant checks from [validation.md](references/validation.md) pass, or the blocker is stated.
- The user has a short list of manual or external follow-ups.
