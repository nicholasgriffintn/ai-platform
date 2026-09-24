# @ngriffin_uk/polychat-library-model-catalogue

The model catalogue data and its schema. `src/data` holds one JSON file per provider, generated from models.dev, and `modelCatalogue` is the parsed, validated result.

```ts
import {
  getCatalogueModels,
  listCatalogueProviders,
} from "@ngriffin_uk/polychat-library-model-catalogue";

const providers = listCatalogueProviders();
const models = getCatalogueModels();
```

## Sync

Refresh the data from models.dev with:

```sh
pnpm --filter @ngriffin_uk/polychat-library-model-catalogue models:sync
```

The `sync-models-dev` workflow runs the same script on a schedule and opens a pull request when the data changes. The package build validates the generated files against `modelCatalogueSchema` and emits a pre-resolved runtime module, so a bad catalogue fails the build without adding schema validation to Worker startup. See `references/operations/model-catalogue.md` in the setup skill for the full procedure.
