# White-label Polychat

White-labelling is a cross-system identity change. Agree the brand and target surfaces first, then change one layer at a time and validate after each layer.

## Collect the decisions

Recommend defaults and ask for missing values that cannot be inferred:

- Product name, short name, tagline, description, contact link, jurisdiction, and legal effective dates.
- Web, API, asset, analytics, and email domains.
- Primary logo, favicon, app icon, theme colours, and alternative logo treatment.
- Cloudflare Worker and resource naming prefix.
- Public package scope if the fork will publish packages; private `@assistant/*` app workspace names do not need cosmetic renaming.
- iOS display name, bundle identifier, URL scheme, associated domains, Apple client identifiers, and signing team.
- Which legacy `polychat.app` links should continue pointing to upstream documentation and which should become deployment URLs.

## Change the web identity

Inspect and update:

- `apps/app/src/constants.ts` for name, tagline, contacts, legal metadata, production API/WebSocket origins, asset hosts, analytics hosts, and CSP.
- Page metadata and visible copy under `apps/app/src/pages` and `apps/app/src/components`.
- `apps/app/src/components/Core/AppShell.tsx` for structured product metadata.
- `apps/app/public/site.webmanifest`, `opensearch.xml`, `robots.txt`, and `sitemap.xml`.
- `apps/app/public/logo.svg`, `favicon.svg`, and logo variants; update accessible titles as well as artwork.
- `apps/app/.env*` and `apps/app/wrangler.jsonc` for public environment-specific settings and Worker identity.
- Privacy, terms, sign-in, invitation, memory, connector, and notification copy that names Polychat.

Do not mechanically replace CSP or allowlist entries. Classify each origin as the new deployment, an intentional upstream dependency, or removable.

## Change the API identity

Inspect and update:

- `apps/api/src/constants/app.ts` and `apps/api/src/constants/analytics.ts`.
- OpenAPI title, descriptions, server examples, and hosted links under `apps/api/src/openapi`.
- Authentication emails, workspace invitations, SMS prompts, GitHub integration metadata, user agents, and provider-facing labels.
- `apps/api/wrangler.jsonc.example` plus the deployment's active Cloudflare configuration.
- Bucket, database, queue, service, Durable Object, analytics dataset, and rate-limit namespace names where a fork requires isolated resources.

Resource renames are migrations, not text edits. Inventory existing data and service bindings before changing a deployed name.

## Change optional workers and integrations

- Update sandbox and training Worker names and every matching API service binding together.
- Review branch prefixes, bot name/email, user agents, issuer/audience values, and internal service URLs before changing them; some are protocol identity rather than presentation.
- Update GitHub App URLs and callback/webhook settings in GitHub.
- Update Composio callback verifier, webhook endpoint, signing secret, and stable environment namespace.
- Update Stripe, email, analytics, captcha, OAuth, and provider dashboard origins.

## Change the iOS identity

Inspect and update:

- Xcode project and target names only if a source/module rename is desired.
- Product display name, bundle identifiers, code-signing team, entitlements, URL scheme, associated domains, and web credentials.
- `Info.plist` API URL and user-facing permission descriptions.
- Swift visible strings, Siri/App Intent phrases, authentication callbacks, fallback URLs, keychain service, and network user agent.
- Asset catalogues, app icons, and logo accessibility labels.

Bundle IDs, schemes, associated domains, and keychain service names affect login, deep links, credentials, upgrades, and App Store identity. Explain whether existing users must migrate before editing them.

## Search and review

Search tracked files for at least:

```text
Polychat
polychat.app
api.polychat.app
@assistant
@ngriffin_uk/polychat
personal-assistant
assistant-
polychat-
```

Review every remaining match. Keep deliberate references to the upstream project, third-party resources, migration history, fixtures, or compatibility protocols; change deployment identity and user-facing brand references. Do not bulk-replace generated files or migration history.

Finish with [validation.md](validation.md), plus auth callback, CSP, deep-link, webhook, and service-binding checks for every changed surface.
