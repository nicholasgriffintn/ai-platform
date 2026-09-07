# Automatic desktop updates need an update-signing key before they can be switched on

- **Change:** The release pipeline produces signed update artefacts whenever `TAURI_SIGNING_PRIVATE_KEY` is present, and the API serves them from `/desktop/releases/:target/:arch/:current_version`. The desktop application does not yet ask, because no key exists: `plugins.updater` in `apps/desktop/src-tauri/tauri.conf.json` is inactive with an empty `pubkey`, and the updater plugin is not registered in the Rust core.
- **Surfaces:** desktop.
- **Prerequisites:** an operator must generate the keypair; the private half is a secret this repository must never hold in a tracked file. ADR 0028 already lists installer signing, notarisation and update-signing keys as procurement that gates release.
- **Risk if wrong:** a build enables the updater with no valid public key, and the application fails to start; or updates ship unsigned and anything that can answer the endpoint can install code.
- **Commits:** this change.

## Verify

- [ ] Generate the keypair with `pnpm --filter @assistant/desktop tauri signer generate`, and keep the private half out of the repository.
- [ ] Add `TAURI_SIGNING_PRIVATE_KEY` and, if the key is passphrased, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as repository secrets.
- [ ] Put the public half in `plugins.updater.pubkey`, set `plugins.updater.active` to `true`, add `tauri-plugin-updater` to the Rust core with its capability permission, and confirm the application still starts.
- [ ] Publish a release and confirm the build uploaded the update artefact and its `.sig` alongside the archives.
- [ ] Install the previous version, then confirm it offers and applies the update on macOS and on Windows.

**Stop and report if:** the updater is enabled while `pubkey` is empty, or an update installs without a signature check.
