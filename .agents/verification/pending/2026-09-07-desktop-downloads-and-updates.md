# The website hands out desktop builds, and the updater has somewhere to ask

- **Change:** The API gained `/desktop/downloads`, `/desktop/downloads/:bundle`, `/desktop/updates/:bundle/:filename` and `/desktop/releases/:target/:arch/:current_version`, all resolved from the published GitHub releases and streamed back so no shipped surface names GitHub. The website added `/downloads`.
- **Surfaces:** API and web.
- **Prerequisites:** `DESKTOP_RELEASES_REPOSITORY` must name the repository holding the releases; it is set in `apps/api/wrangler.json`. `DESKTOP_RELEASES_TOKEN` is optional and only raises the GitHub read rate limit. At least one `desktop-v*` release must exist before any of these answer.
- **Risk if wrong:** The downloads page shows nothing, hands out the wrong build, or the API streams from an address outside the release hosts.
- **Commits:** this change.

## Verify

- [ ] Visit `/downloads` on the deployed site and confirm it lists the current version with one card per published platform.
- [ ] Download the macOS archive from that page and confirm the browser stays on the Polychat domain and the file opens.
- [ ] Request `/desktop/releases/darwin/aarch64/0.0.1` and confirm it answers `204` while no signed update artefact exists.
- [ ] Request `/desktop/downloads/solaris-sparc` and confirm it answers `404` rather than an error page.

**Stop and report if:** any response redirects to or names `github.com`, or a download serves an archive from a version other than the one `/desktop/downloads` reports.
