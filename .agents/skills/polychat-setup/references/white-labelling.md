# White-label Polychat

A brand change can also change authentication and resource identity. Establish the new name, domains, artwork, contact/legal details, selected clients and external account ownership before editing.

## Update identity together

- **Web:** `apps/app/src/constants.ts`, visible and legal copy, page/OpenSearch metadata, `public/site.webmanifest`, sitemap, robots, logos, favicons, environment origins and Wrangler identity. Update accessible artwork titles.
- **API:** app/analytics constants, OpenAPI metadata, auth and invitation emails, messaging copy, GitHub integration labels, example manifest and the active deployment manifest.
- **Infrastructure:** Worker names and matching service bindings, buckets, databases, queues, routes and domains. Renaming deployed resources is a data migration, not a cosmetic replacement.
- **External services:** OAuth callbacks, passkeys, cookies, CSP/CORS, email, Composio verifier/webhook/namespace, Stripe webhooks, GitHub App settings and media hosts.
- **iOS:** display name, bundle ID, URL scheme, associated domains, web credentials, signing, API origin, keychain identity, App Intents and artwork. Explain upgrade and credential migration consequences before changing installed identity.

Keep private `@assistant/*` workspace names unless a tooling change requires renaming. Choose a new public package scope only if publishing the fork's packages.

## Verify

Search non-generated files for `Polychat`, `polychat.app`, `@ngriffin_uk/polychat`, `personal-assistant`, `assistant-` and `polychat-`. Classify each remaining match as deployment identity, deliberate upstream reference or compatibility history. Do not bulk-replace migration history, provider origins or protocol identifiers.

Run relevant static checks, then record manual auth, callback, deep-link, webhook and service-binding checks for changed surfaces. Keep required external dashboard changes in the handoff.
