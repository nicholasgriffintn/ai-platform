# Changesets

Create a changeset for every change to a public package interface or behaviour:

```bash
pnpm changeset
```

Application-only composition, tests, and documentation do not require a changeset. Before a
manual release, run `pnpm release:check`, apply versions with `pnpm changeset:version`, review the
result, then run `pnpm release:publish`. Publishing remains manual until trusted publishing is
configured.
