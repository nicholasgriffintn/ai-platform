import { toolCategories, type ToolCategory } from "@ngriffin_uk/polychat-schemas";

const TOOL_IDS_BY_CATEGORY: Partial<Record<ToolCategory, readonly string[]>> = {
  Research: [
    "analyse_article",
    "find_places",
    "audit_evidence",
    "get_hacker_news_stories",
    "get_on_this_day",
    "capture_screenshot",
    "extract_content",
    "extract_text_from_document",
    "get_weather",
    "research",
    "web_search",
  ],
  "Film and TV": [
    "cinema_listings",
    "connect_trakt",
    "import_from_trakt",
    "discover_titles",
    "find_similar_titles",
    "follow_person",
    "get_episode_progress",
    "get_season_ratings",
    "get_shelf",
    "get_title",
    "latest_trailers",
    "mark_episodes",
    "recommend_from_taste",
    "save_to_shelf",
    "search_anime",
    "search_by_meaning",
    "search_titles",
    "title_background",
    "titles_by_person",
    "whats_on",
    "where_to_watch",
  ],
  Creative: [
    "generate_pattern",
    "generate_podcast",
    "grade_writing",
    "build_site",
    "create_image",
    "create_music",
    "create_qr_code",
    "create_speech",
    "create_video",
  ],
  Code: [
    "apply_edit_completion",
    "fill_in_middle_completion",
    "next_edit_completion",
    "run_code",
    "run_sandbox_task",
  ],
  Productivity: [
    "configure_knowledge_sync",
    "create_task",
    "file_in_notebook",
    "get_document",
    "get_task",
    "list_tasks",
    "read_memory_document",
    "search_documents",
    "update_task",
    "write_deck",
    "write_document",
    "write_sheet",
    "calculate",
    "configure_recipe",
    "create_note",
    "get_current_time",
    "get_note",
    "get_recipe",
    "get_user_information",
    "search_conversations",
    "search_memories",
    "store_memory",
    "trigger_recipe",
    "use_recipe_connector",
  ],
  Automation: [
    "create_automation",
    "use_computer",
    "desktop_list_directory",
    "desktop_read_file",
    "desktop_search_files",
    "desktop_write_file",
    "call_api",
    "decide",
    "discover_capabilities",
    "extract_values",
    "run_pashi_tools",
    "search_pashi_tools",
  ],
  Collaboration: [
    "ask_user",
    "review_output",
    "run_council",
    "select_council_members",
    "request_approval",
    "message_parent",
    "delegate",
  ],
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
