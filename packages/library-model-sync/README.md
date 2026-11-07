# @ngriffin_uk/polychat-library-model-sync

Keeps `@ngriffin_uk/polychat-library-model-catalogue` current. It reads models.dev and the public provider model lists, then writes the catalogue data.

```sh
pnpm exec vp run --filter=@ngriffin_uk/polychat-library-model-catalogue build
pnpm --filter @ngriffin_uk/polychat-library-model-sync models:sync
```

The command defaults to a dry run. See `references/operations/model-catalogue.md` in the setup skill for the full procedure.
