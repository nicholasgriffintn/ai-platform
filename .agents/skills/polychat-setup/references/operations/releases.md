# Release the applications

Changesets versions everything in the monorepo, including the private applications. Merging a
changeset that names an application is what releases it: nothing is tagged or published because a
dependency moved underneath it.

## The loop

1. A pull request carries a changeset for every package or application whose behaviour changes.
   `pnpm changeset` writes it.
2. Pushing to `main` runs **Release**, which opens or updates a `chore: version packages` pull
   request. That pull request applies the pending changesets: it bumps versions, writes each
   `CHANGELOG.md`, and runs `scripts/sync-native-versions.mjs` so the Tauri configuration, the Rust
   crate and the Xcode `MARKETING_VERSION` carry the same version as their `package.json`.
3. Merging that pull request pushes the new versions to `main`. **Release** then plans the
   application releases with `pnpm release:plan` and publishes the ones that qualify.

## What qualifies as a release

`scripts/app-releases.mjs` releases an application when both hold:

- its `CHANGELOG.md` entry for the current version contains something other than
  `Updated dependencies` lines, meaning a changeset named the application directly, and
- the tag for that version does not already exist.

Applications and their tags:

| Application | Package              | Tag                  | Assets            |
| ----------- | -------------------- | -------------------- | ----------------- |
| Web         | `@assistant/app`     | `web-v<version>`     | none              |
| iOS         | `@assistant/mobile`  | `ios-v<version>`     | none              |
| Desktop     | `@assistant/desktop` | `desktop-v<version>` | platform archives |

Run `pnpm release:plan` locally to see the same decision without publishing anything.

## Desktop builds

**Desktop build** is a reusable workflow shared by the pull-request checks and the release. It
bundles on macOS, Windows and Linux runners and uploads one archive per platform:

- `polychat-desktop-<version>-macos-universal.zip` — the universal `.app`.
- `polychat-desktop-<version>-windows-x86_64.zip` — the NSIS installer and the MSI.
- `polychat-desktop-<version>-linux-x86_64.zip` — the AppImage and the Debian package.

The build always signs. It needs `TAURI_SIGNING_PRIVATE_KEY` and its password for the update
artefacts, which it writes alongside the archives using `src-tauri/tauri.updater.conf.json`, and
the Apple secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8`) to sign and notarise the macOS bundle.
Both callers pass `secrets: inherit`; a missing secret fails the build rather than producing an
unsigned artefact.

Pull requests touching `apps/desktop` run **Desktop**: renderer typecheck and tests, then
`cargo fmt --check`, `cargo clippy -- -D warnings` and `cargo test`, then the same three-platform
bundle. The Rust core embeds the built renderer, so the renderer is built before cargo runs.

The Linux leg also drives the packaged window through `tauri-driver` under `xvfb`, covering that the
renderer boots, offers sign-in and cannot reach a runtime past the content security policy. That
step reports without gating until it has proved stable; the pending verification item says when to
make it blocking. `tauri-driver` does not reach macOS, so macOS packaged behaviour stays an operator
check.

## Serving builds

The API owns distribution so that neither the website nor the desktop application knows where the
builds live.

- `GET /desktop/downloads` lists the current archives with API addresses.
- `GET /desktop/downloads/:bundle` streams an archive.
- `GET /desktop/releases/:target/:arch/:current_version` answers the Tauri updater with a signed
  manifest, or `204` when the installed version is current or the platform has no signed artefact.
- `GET /desktop/updates/:bundle/:filename` streams the update artefact the manifest names.

`DESKTOP_RELEASES_REPOSITORY` names the repository holding the releases.
`DESKTOP_RELEASES_TOKEN` is optional and only raises the read rate limit. The API refuses any asset
address outside GitHub's release hosts.

The website reads the same list at `/downloads`.

## Publishing packages

Publishing `@ngriffin_uk/polychat-*` to npm stays manual. Run `pnpm release:check`, then
`pnpm release:publish`.
