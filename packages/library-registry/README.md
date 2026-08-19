# @ngriffin_uk/polychat-library-registry

Register implementations under a category, resolve them by name or alias, and cache singleton
instances. Polychat's provider and tool registries are thin typed facades over this module.

```ts
import { CategoryRegistry } from "@ngriffin_uk/polychat-library-registry";

const registry = new CategoryRegistry<{ chat: ChatProvider }, FactoryContext>();

registry.register("chat", {
  name: "openai",
  aliases: ["oai"],
  create: (context) => new OpenAIProvider(context),
});

const provider = registry.resolve("chat", "OAI", context);
```

Resolution lowercases names, so registrations and lookups do not need to agree on case.
A `singleton` registration (the default) creates its instance once and reuses it; a `transient`
one creates a new instance per resolve.

Failures throw `RegistryError` with a `code` of `duplicate_registration`, `unknown_category`, or
`unknown_entry`, plus the `category` and `entryName` involved. The package does not format
host-facing messages: map the error to your own error type at the call site.
