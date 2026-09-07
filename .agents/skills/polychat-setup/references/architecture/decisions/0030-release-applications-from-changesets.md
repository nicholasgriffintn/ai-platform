# ADR 0030: Release applications from changesets and hand out builds through the API

Status: Implemented. Automatic updates remain off until an update-signing key exists.

## Problem

Changesets versioned the published packages but treated every application as private and therefore ignored. Authors wrote changesets naming applications anyway, and a changeset mixing an ignored application with a tracked package made `changeset version` refuse to run at all, so nothing had been versioned since.

The desktop shell then arrived with a harder requirement. It is not a Worker a deploy script replaces: it is a signed artefact a person installs, so it needs a durable version, readable notes and a place to fetch the build, and its configuration already named an update endpoint that did not exist. The web and iOS applications had no release record at all, and the desktop application is expensive to build — three runners and a Rust compile — so rebuilding it whenever an unrelated package moved would have been most merges.

## Decision

An application releases when a changeset names it, and not otherwise.

Private packages are versioned, so the web, mobile and desktop applications carry real versions and changelogs. Because applications sit at the bottom of the dependency graph they also take a patch bump whenever a package they depend on moves, and that bump is deliberately not a release. The gate reads the changelog entry for the current version: an entry made only of `Updated dependencies` lines describes a rebuild, while any other content means an author decided this change was worth telling people about. A release therefore reflects an editorial judgement already recorded in the changeset rather than a graph traversal.

Each application owns a tag namespace — `web-v`, `ios-v`, `desktop-v` — so the three release lines move independently and a missing tag is the idempotency check. The same plan runs locally through `pnpm release:plan`, so the decision is inspectable before it happens.

Native version numbers are derived rather than maintained. `changeset version` is followed by a script that writes the same version into the Tauri configuration, the Rust crate, its lockfile entry and the Xcode `MARKETING_VERSION`. Those files are outputs of the release, not inputs to it.

Distribution goes through the API rather than through links to the forge. The website asks the API what the current builds are and downloads them from it; the desktop updater asks the API whether a newer build exists and fetches the artefact from it. The API resolves both from GitHub releases and refuses any asset address outside GitHub's release hosts, so where builds are stored becomes an implementation detail the API can change without touching a shipped application.

## Consequences

Release notes are only as good as the changesets, which is the point: an application with a dependency-only changelog entry stays unreleased until someone writes what changed for the people using it. The cost is that a package fix reaching users through a rebuild produces no release of its own, and the changelog entry recording it waits for that application's next real release.

The desktop pull-request checks and the desktop release share one reusable workflow, so a bundle that fails on Windows fails in review rather than during a release. That makes desktop pull requests slow, and a path filter keeps the cost off every other change — which means a change to a shared package can still break the desktop bundle without triggering those checks, with the release build as the backstop.

Proxying archives through the API costs egress and a subrequest per download, bought in exchange for never naming the forge in a shipped application or a published page. The updater half is inert until an update-signing key exists: builds without the key still produce installers and still publish, and the API answers `204` for any platform whose signed artefact is missing, so the absence degrades quietly instead of failing. See [releases](../../operations/releases.md) for the operator procedure.
