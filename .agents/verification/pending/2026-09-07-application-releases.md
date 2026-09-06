# Merging a changeset that names an application publishes its GitHub release

- **Change:** Changesets now versions the private applications, and pushing to `main` opens a version pull request whose merge tags and publishes a GitHub release for each application a changeset named directly. The desktop release carries macOS, Windows and Linux archives built by the shared Desktop build workflow.
- **Surfaces:** GitHub Actions and GitHub Releases; no runtime surface changes.
- **Prerequisites:** Repository settings must allow GitHub Actions to create pull requests, otherwise the version pull request cannot be opened. A pull request opened by `GITHUB_TOKEN` does not start other workflows, so the version pull request runs no checks unless a `RELEASE_TOKEN` personal access token with `repo` and `workflow` scope is added as a repository secret; the Release workflow prefers it when present.
- **Risk if wrong:** Versions land on `main` with no release, or a release publishes without the archives someone is meant to download.
- **Commits:** this change.

## Verify

- [ ] Push to `main` and confirm the Release workflow opens a `chore: version packages` pull request listing the pending changesets.
- [ ] Merge that pull request and confirm the Release workflow creates `desktop-v<version>` with the three platform archives attached, and that the release notes match `apps/desktop/CHANGELOG.md` for that version.
- [ ] Download the macOS archive from the release, open the application, and confirm it launches and signs in.
- [ ] Push a change that only bumps packages, and confirm no application release is created.
- [ ] Confirm `apps/desktop/src-tauri/tauri.conf.json`, its `Cargo.toml` and the Xcode `MARKETING_VERSION` carry the versions the release used.

**Stop and report if:** a release is created for an application no changeset named, or a desktop release publishes with fewer than three archives.
