# @ngriffin_uk/polychat-schemas

Shared Zod schemas and TypeScript types for contracts used across Polychat apps, API modules and workers.

Import public exports from the package root:

```ts
import { messageSchema } from "@ngriffin_uk/polychat-schemas";

const message = messageSchema.parse(input);
```

Keep shared request, response, event and persisted-data contracts here. Put feature rules in the owning module and client-specific view state in the owning app. When a contract changes, update and validate every consumer.
