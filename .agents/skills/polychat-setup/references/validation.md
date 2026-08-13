# Validate setup changes

Run the narrowest checks that cover the changed surfaces. Build shared schemas first when consumers depend on their generated output.

## Documentation-only changes

- Check Markdown links and referenced paths.
- Search for deleted guide paths and stale commands.
- Confirm `SKILL.md` frontmatter contains only `name` and `description` and that all routed references exist.
- Confirm setup instructions match current `package.json` scripts and example configuration files.

## Core workspaces

```sh
pnpm --filter @ngriffin_uk/polychat-schemas build
pnpm --filter @assistant/api typecheck
pnpm --filter @assistant/app typecheck
pnpm --filter @assistant/api check
pnpm --filter @assistant/app check
```

Run relevant Vitest suites for behaviour changes. Use the root `pnpm typecheck`, `pnpm check`, or `pnpm test` only when the blast radius justifies repo-wide validation.

## Optional components

```sh
pnpm --filter @assistant/sandbox-worker typecheck
pnpm --filter @assistant/sandbox-worker check
pnpm --filter @assistant/training typecheck
pnpm --filter @assistant/training check
pnpm test:mobile
```

Run only checks for selected or changed components. iOS validation requires Xcode and appropriate local tooling.

## White-label validation

- Search all tracked, non-generated files for old brand names, domains, resource prefixes, bundle IDs, and URL schemes.
- Check web metadata, manifests, sitemap, robots, logo titles, legal copy, API/OpenAPI metadata, emails, and iOS visible strings.
- Verify CSP, CORS, cookies, OAuth callbacks, passkey origins, universal links, web credentials, webhooks, R2 URLs, and WebSocket origins.
- Confirm Cloudflare service bindings and external dashboard configuration use the same environment names.
- Treat remaining upstream-project references as deliberate and document them.

Do not start a development server for routine validation. Use the documented server command only when runtime browser or service-binding behaviour cannot be checked otherwise, and stop every server before finishing.
