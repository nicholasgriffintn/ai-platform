# @ngriffin_uk/polychat-library-composio

The Composio integration catalogue: configured toolkit data, the schema that resolves it into connector operations and auth configs, the session handle contract, and the sync that maintains them. Hosts read it through `@ngriffin_uk/polychat-ai-integrations` rather than carrying their own toolkit tables.

```ts
import {
  configuredComposioToolkits,
  getConfiguredComposioToolkit,
  isComposioConnectorSessionHandle,
} from "@ngriffin_uk/polychat-library-composio";

const toolkit = getConfiguredComposioToolkit("gmail");
const handle = isComposioConnectorSessionHandle("ccs_abc") ? "ccs_abc" : undefined;
```

`configuredComposioToolkits` is parsed through `composioToolkitCatalogueSchema` at import, so malformed generated data fails at build time and operation access, destructive, idempotent, open-world and important flags stay exact booleans.

## Sync

`pnpm --filter @ngriffin_uk/polychat-library-composio composio:sync` reads Composio's enabled auth configs and tools and regenerates `src/data/toolkits/*.json`, `src/data/index.ts` and the generated provider id list in `@ngriffin_uk/polychat-schemas`. It defaults to a dry run; pass `--write` to apply and `--snapshot <path>` to replay a saved manifest without network access. The script reads `COMPOSIO_API_KEY` from the environment or `apps/api/.dev.vars`. Generated data is excluded from lint and formatting and validated by the catalogue schema instead.
