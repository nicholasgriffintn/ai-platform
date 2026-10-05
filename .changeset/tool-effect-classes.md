---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-tools": minor
"@assistant/api": patch
---

Declare what each tool changes. `TOOL_EFFECT_CLASSES` names eight effect classes, `ToolDefinition.effects` declares a tool's class and destination, and `resolveToolEffectClass` treats an undeclared tool as a write. The API's built-in catalogue now refuses a tool without effects, and `call_api` and `use_recipe_connector` classify each call from its input.
