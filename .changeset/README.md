# Changesets

Create a changeset for every change to a public package interface or behaviour:

```bash
pnpm changeset
```

Name an application (`@assistant/app`, `@assistant/mobile`, `@assistant/desktop`) when the change is
one its users would notice. That is what releases it: an application picked up only as a dependency
bump is versioned but never tagged. Application-only composition, tests and documentation still need
no changeset.

Merging to `main` opens a `chore: version packages` pull request. Merging that applies the versions,
writes the changelogs and publishes the qualifying application releases. See
[releases](../.agents/skills/polychat-setup/references/operations/releases.md) for the whole loop and
`pnpm release:plan` for what would be released right now.

Publishing packages to npm remains manual: run `pnpm release:check`, review, then
`pnpm release:publish`.
