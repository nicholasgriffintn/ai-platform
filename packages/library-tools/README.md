# @ngriffin_uk/polychat-library-tools

Tool primitives: declare a tool with a Zod input schema, register it under a category, build a catalogue, validate input, and execute it with a host-supplied context. Provider-specific declaration shapes and the agent control tools live here too.

```ts
import { createToolCatalogue, defineTool, executeTool } from "@ngriffin_uk/polychat-library-tools";
import { z } from "zod";

const weather = defineTool({
  name: "get_weather",
  description: "Current weather for a city",
  type: "normal",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }, context) => ({ content: await context.fetchWeather(city) }),
});

const catalogue = createToolCatalogue([weather]);
const result = await executeTool(catalogue.resolve("get_weather"), { city: "Leeds" }, context);
```

`toToolDeclaration` renders a definition as a JSON Schema declaration, and `toProviderToolDeclarations` converts declarations to the Anthropic or Bedrock wire shape. `jsonSchemaToZod` goes the other way for tools declared by external systems.

`PermissionChecker` and `resolveToolPermissions` decide which tools a subject may call. Failures throw `ToolError` with a `code` (`unknown_category`, `unknown_tool`, `duplicate_registration`, `invalid_input`, `invalid_schema`, `missing_permissions`, `missing_effects`) so hosts map them to their own error type at one site.

## Declare what a tool changes

Give each tool an `effects` declaration so approval and autonomy rules can reason about the call rather than the tool's name. The class may depend on the input, and a destination names where the effect lands.

```ts
const callApi = defineTool({
  name: "call_api",
  permissions: ["network", "write"],
  effects: {
    effectClass: (input) =>
      input.method === "DELETE" ? "destructive" : input.method === "GET" ? "read" : "write",
    destination: (input) => new URL(input.url).origin,
  },
  // ...
});

resolveToolEffectClass(callApi.effects, { url, method: "GET" }); // "read"
```

Classes come from `TOOL_EFFECT_CLASSES` in `@ngriffin_uk/polychat-schemas`. A tool without a declaration resolves to `write`, so an omission asks rather than runs. Hosts that own a closed catalogue call `requireToolEffects` while building it, which throws `missing_effects` for an undeclared tool.
