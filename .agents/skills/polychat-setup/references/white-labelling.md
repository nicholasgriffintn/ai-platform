# White-label Polychat

Apply identity changes as a coordinated set:

- Update web strings, metadata, copy, branding assets, and supported domains.
- Update API constants, OAuth providers, invite/callback text, and auth branding.
- Update any worker/service names, queues, buckets, routes, and third-party callback settings as needed.
- Update mobile identity: bundle ID, scheme, signing, API origin, deep links, and credentials.

## Safe rollout checks

- Replace only deliberate references to public names in visible surfaces first; keep protocol constants/migration IDs intact unless migration is planned.
- Search for old identity across non-generated files and group changes by surface.
- Verify callback URLs, OAuth redirects, cookies/passkeys, webhook signing, and deep links before treating as complete.
- Do not rename shared package scopes unless publishing a fork is part of the work.
