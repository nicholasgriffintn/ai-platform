/**
 * Function tools the model uses internally. They are excluded from the capability
 * discovery catalogue so they never surface as user-selectable capabilities.
 */
export const INTERNAL_FUNCTION_TOOLS = new Set<string>([
  "ask_user",
  "configure_recipe",
  "get_recipe",
  "load_skill",
  "react",
  "request_approval",
  "search_pashi_tools",
  "trigger_recipe",
  "use_recipe_connector",
]);

/**
 * Function tools that are never useful to run by hand. The capability library and public
 * catalogue hide these on top of the internally discovered tools.
 */
export const NON_RUNNABLE_FUNCTION_TOOLS = new Set<string>([
  ...INTERNAL_FUNCTION_TOOLS,
  "complete_goal",
  "propose_correction",
  "save_skill",
  "set_goal",
]);
