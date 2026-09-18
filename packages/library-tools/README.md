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

`PermissionChecker` and `resolveToolPermissions` decide which tools a subject may call. Failures throw `ToolError` with a `code` (`unknown_category`, `unknown_tool`, `duplicate_registration`, `invalid_input`, `invalid_schema`, `missing_permissions`) so hosts map them to their own error type at one site.
