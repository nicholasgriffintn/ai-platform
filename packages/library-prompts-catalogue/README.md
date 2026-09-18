# @ngriffin_uk/polychat-library-prompts-catalogue

Every authored Polychat prompt and prompt fragment as data, plus the schema that validates entries and resolves them by id, task and variant. This package holds text only: no builders, no rendering, no runtime dependencies.

```ts
import {
  getCataloguePromptEntry,
  getCataloguePromptEntryByTask,
  listCataloguePromptEntries,
} from "@ngriffin_uk/polychat-library-prompts-catalogue";

const safety = getCataloguePromptEntry("chat/safety");
const formatters = listCataloguePromptEntries({ task: "chat-section" });
const title = getCataloguePromptEntryByTask("conversation-title");
```

Entries live in `src/data`, grouped by domain. An entry has an `id` (`chat/safety`, `apps/articles/analyse`), a `task` from the shared taxonomy, a human-readable `title` and `description`, the prompt `text`, and any `variables` it declares.

## Templates

`text` supports `{{variable}}` interpolation and `{{#variable}}...{{/variable}}` / `{{^variable}}...{{/variable}}` conditionals. Declare every variable in `variables` with a description and optional default; `validatePromptCatalogue` (run by the package tests) rejects undeclared or unused variables, duplicate ids and invalid shapes.

Use [`@ngriffin_uk/polychat-ai-prompts`](../ai-prompts) to retrieve and render these entries. Consumers should not import individual data modules; the catalogue is the only source of prompt text.
