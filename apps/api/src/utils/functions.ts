import { ToolResponseType } from "@ngriffin_uk/polychat-schemas";

export interface ToolPresentation {
  renderer?: string;
  icon?: string;
  responseType?: ToolResponseType;
}

export const formatFunctionName = (name: string): string => {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const DEFAULT_ICON = "app";

const TOOL_PRESENTATIONS: Record<string, ToolPresentation> = {
  get_weather: { renderer: "weather", icon: "cloud" },
  web_search: { renderer: "web_search", icon: "search" },
  search_documents: { renderer: "document_search", icon: "search" },
  search_memories: { icon: "search", responseType: ToolResponseType.HIDDEN },
  store_memory: { icon: "plus-circle" },
  discover_capabilities: { renderer: "capability_discovery", icon: "sparkles" },
  research: { renderer: "research", icon: "search" },
  council_turn: { renderer: "council_turn", icon: "bot" },
  select_council_members: { renderer: "council_member_picker", icon: "bot" },
  run_council: { renderer: "council_conclusion", icon: "bot" },
  second_opinion_turn: { renderer: "second_opinion_turn", icon: "bot" },
  second_opinion: { renderer: "second_opinion", icon: "bot" },
  run_sandbox_task: { renderer: "sandbox_result", icon: "terminal" },
  request_approval: { renderer: "approval_request", icon: "alert-triangle" },
  ask_user: { renderer: "user_question", icon: "lightbulb" },
  create_image: { icon: "image" },
  capture_screenshot: { icon: "image" },
  create_video: { icon: "video" },
  create_music: { icon: "music" },
  create_speech: { icon: "speech" },
  create_qr_code: { icon: "qr-code" },
  create_note: { icon: "note" },
  get_note: { icon: "note" },
  extract_content: { icon: "file-text" },
  extract_text_from_document: { icon: "file-text" },
  get_hacker_news_stories: { icon: "globe" },
  call_api: { icon: "braces", responseType: ToolResponseType.JSON },
  get_task_status: { icon: "terminal" },
  create_task: { icon: "list-checks" },
  list_tasks: { icon: "list-checks" },
  update_task: { icon: "list-checks" },
  load_skill: { icon: "sparkles" },
  set_goal: { icon: "target", responseType: ToolResponseType.HIDDEN },
  complete_goal: { icon: "target", responseType: ToolResponseType.HIDDEN },
};

export const getToolPresentation = (name: string): ToolPresentation => {
  const declared = TOOL_PRESENTATIONS[name];

  if (declared) {
    return declared;
  }

  if (name.startsWith("mcp_")) {
    return { icon: "braces" };
  }

  return {};
};

export const getFunctionIcon = (name: string): string =>
  getToolPresentation(name).icon ?? DEFAULT_ICON;

export const getFunctionResponseType = (name: string): ToolResponseType | undefined =>
  getToolPresentation(name).responseType;

export const getFunctionRenderer = (name: string): string | undefined =>
  getToolPresentation(name).renderer;
