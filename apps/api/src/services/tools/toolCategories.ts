import { toolCategories, type ToolCategory } from "@ngriffin_uk/polychat-schemas";

const TOOL_IDS_BY_CATEGORY: Partial<Record<ToolCategory, readonly string[]>> = {
  Research: [
    "get_hacker_news_stories",
    "capture_screenshot",
    "extract_content",
    "extract_text_from_document",
    "get_weather",
    "research",
    "web_search",
  ],
  Creative: ["create_image", "create_music", "create_qr_code", "create_speech", "create_video"],
  Code: [
    "apply_edit_completion",
    "fill_in_middle_completion",
    "next_edit_completion",
    "run_bug_fix",
    "run_code_review",
    "run_documentation",
    "run_feature_implementation",
    "run_migration",
    "run_refactoring",
    "run_test_suite",
    "v0_code_generation",
  ],
  Productivity: [
    "configure_recipe",
    "create_note",
    "get_note",
    "get_recipe",
    "search_memories",
    "store_memory",
    "trigger_recipe",
    "use_recipe_connector",
  ],
  Automation: ["call_api", "discover_capabilities", "run_pashi_tools", "search_pashi_tools"],
  Collaboration: ["ask_user", "run_council", "select_council_members", "request_approval"],
};

export function getToolCategory(toolId: string): ToolCategory {
  if (toolId.startsWith("connector_")) {
    return "Productivity";
  }

  for (const category of toolCategories) {
    if (TOOL_IDS_BY_CATEGORY[category]?.includes(toolId)) {
      return category;
    }
  }

  return "Other";
}
