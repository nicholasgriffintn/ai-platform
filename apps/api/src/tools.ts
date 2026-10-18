import { discover_capabilities } from "~/modules/assistant-capabilities/application/tools/discover_capabilities";
import { apply_edit_completion } from "~/modules/code/application/tools/apply_edit";
import { fill_in_middle_completion } from "~/modules/code/application/tools/fill_in_middle";
import { next_edit_completion } from "~/modules/code/application/tools/next_edit";
import { use_computer } from "~/modules/computer-use/application/tools/use_computer";
import { list_saved_messages } from "~/modules/conversations/application/tools/list_saved_messages";
import { react } from "~/modules/conversations/application/tools/react";
import { search_conversations } from "~/modules/conversations/application/tools/search_conversations";
import { propose_correction } from "~/modules/corrections/application/tools/propose_correction";
import {
  review_output,
  run_council,
  select_council_members,
} from "~/modules/decisions/application/tools/council";
import { decide } from "~/modules/decisions/application/tools/decide";
import { delegate } from "~/modules/delegations/application/tools/delegate";
import { messageParent } from "~/modules/delegations/application/tools/message-parent";
import { get_document } from "~/modules/documents/application/tools/get_document";
import { grade_writing } from "~/modules/documents/application/tools/grade_writing";
import { write_document } from "~/modules/documents/application/tools/write_document";
import { run_code } from "~/modules/evaluate/application/tools/run_code";
import { audit_evidence } from "~/modules/evidence/application/tools/audit_evidence";
import { analyse_article } from "~/modules/experiences/application/tools/analyse_article";
import { generate_pattern } from "~/modules/experiences/application/tools/generate_pattern";
import { process_recording } from "~/modules/experiences/application/tools/process_recording";
import { run_prediction } from "~/modules/experiences/application/tools/run_prediction";
import { create_image } from "~/modules/generate/application/tools/image";
import { create_music } from "~/modules/generate/application/tools/music";
import { create_speech } from "~/modules/generate/application/tools/speech";
import { create_video } from "~/modules/generate/application/tools/video";
import { complete_goal, set_goal } from "~/modules/goals/application/tools/goal";
import {
  read_memory_document,
  search_memories,
  store_memory,
} from "~/modules/memory/application/tools/memory";
import { polyNavigationTools } from "~/modules/poly/application/tools/poly-navigation";
import {
  create_task,
  get_task,
  list_tasks,
  update_task,
} from "~/modules/project-tasks/application/tools/projectTasks";
import { get_task_status } from "~/modules/queue/application/tools/tasks";
import { configure_recipe } from "~/modules/recipes/application/tools/configure_recipe";
import { create_automation } from "~/modules/recipes/application/tools/create_automation";
import { get_recipe } from "~/modules/recipes/application/tools/get_recipe";
import { trigger_recipe } from "~/modules/recipes/application/tools/trigger_recipe";
import { use_recipe_connector } from "~/modules/recipes/application/tools/use_recipe_connector";
import { research } from "~/modules/research/application/tools/research";
import { run_sandbox_task } from "~/modules/sandbox/application/tools/sandbox";
import { build_site } from "~/modules/sites/application/tools/build_site";
import { load_skill } from "~/modules/skills/application/tools/load_skill";
import { save_skill } from "~/modules/skills/application/tools/save_skill";
import { configure_knowledge_sync } from "~/modules/sources/application/tools/configure_knowledge_sync";
import { create_note } from "~/modules/sources/application/tools/create_note";
import { get_note } from "~/modules/sources/application/tools/get_note";
import { search_documents } from "~/modules/sources/application/tools/search_documents";
import { call_api } from "~/modules/tools/application/builtin/api_call";
import { calculate } from "~/modules/tools/application/builtin/calculate";
import { get_current_time } from "~/modules/tools/application/builtin/current_time";
import { extract_content } from "~/modules/tools/application/builtin/extract_content";
import { get_hacker_news_stories } from "~/modules/tools/application/builtin/hacker_news";
import { hostedMcpApproval } from "~/modules/tools/application/builtin/hosted_mcp_approval";
import { ask_user, request_approval } from "~/modules/tools/application/builtin/human_in_the_loop";
import { mcp_call_tool, mcp_list_tools } from "~/modules/tools/application/builtin/mcp_gateway";
import { extract_text_from_document } from "~/modules/tools/application/builtin/ocr";
import { run_pashi_tools, search_pashi_tools } from "~/modules/tools/application/builtin/pashi";
import { create_qr_code } from "~/modules/tools/application/builtin/qr";
import { capture_screenshot } from "~/modules/tools/application/builtin/screenshot";
import { second_opinion } from "~/modules/tools/application/builtin/second_opinion";
import { get_user_information } from "~/modules/tools/application/builtin/user_information";
import { get_weather } from "~/modules/tools/application/builtin/weather";
import { web_search } from "~/modules/tools/application/builtin/web_search";
import { registerTools } from "~/modules/tools/application/catalogue";

registerTools([
  configure_knowledge_sync,
  get_current_time,
  calculate,
  get_user_information,
  get_weather,
  grade_writing,
  decide,
  audit_evidence,
  build_site,
  create_video,
  create_music,
  create_image,
  fill_in_middle_completion,
  next_edit_completion,
  apply_edit_completion,
  web_search,
  write_document,
  get_document,
  create_qr_code,
  search_pashi_tools,
  run_pashi_tools,
  call_api,
  research,
  search_documents,
  extract_content,
  search_memories,
  search_conversations,
  mcp_list_tools,
  mcp_call_tool,
  read_memory_document,
  store_memory,
  analyse_article,
  create_automation,
  create_note,
  delegate,
  messageParent,
  generate_pattern,
  get_note,
  extract_text_from_document,
  use_recipe_connector,
  get_recipe,
  configure_recipe,
  trigger_recipe,
  get_task_status,
  create_task,
  get_task,
  list_tasks,
  update_task,
  capture_screenshot,
  create_speech,
  discover_capabilities,
  set_goal,
  complete_goal,
  list_saved_messages,
  load_skill,
  process_recording,
  propose_correction,
  react,
  save_skill,
  review_output,
  run_council,
  select_council_members,
  second_opinion,
  get_hacker_news_stories,
  request_approval,
  ask_user,
  run_sandbox_task,
  run_prediction,
  run_code,
  use_computer,
  ...polyNavigationTools,
]);

registerTools([hostedMcpApproval], { listed: false });
