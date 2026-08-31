import type { RecipeConnectorProvider, ToolPermission } from "@ngriffin_uk/polychat-schemas";

import { resolveToolPermissions } from "~/lib/permissions/PermissionChecker";
import { AssistantError, ErrorType } from "~/utils/errors";

import { call_api } from "./api_call";
import { apply_edit_completion } from "./apply_edit";
import { run_council, select_council_members } from "./council";
import { create_note } from "./create_note";
import { discover_capabilities } from "./discover_capabilities";
import { extract_content } from "./extract_content";
import { fill_in_middle_completion } from "./fill_in_middle";
import { get_note } from "./get_note";
import { complete_goal, set_goal } from "./goal";
import { get_hacker_news_stories } from "./hacker_news";
import { ask_user, request_approval } from "./human_in_the_loop";
import { create_image } from "./image";
import { load_skill } from "./load_skill";
import { search_memories, store_memory } from "./memory";
import { create_music } from "./music";
import { next_edit_completion } from "./next_edit";
import { extract_text_from_document } from "./ocr";
import { run_pashi_tools, search_pashi_tools } from "./pashi";
import { create_task, get_task, list_tasks, update_task } from "./projectTasks";
import { create_qr_code } from "./qr";
import { configure_recipe } from "./recipes/configure_recipe";
import { get_recipe } from "./recipes/get_recipe";
import { trigger_recipe } from "./recipes/trigger_recipe";
import {
  use_recipe_connector,
  createUseRecipeConnectorInputSchema,
} from "./recipes/use_recipe_connector";
import { research } from "./research";
import { run_sandbox_task } from "./sandbox";
import { capture_screenshot } from "./screenshot";
import { search_documents } from "./search_documents";
import { second_opinion } from "./second_opinion";
import { create_speech } from "./speech";
import { get_task_status } from "./tasks";
import { delegateToTeamMember, delegateToTeamMemberByRole, getTeamMembers } from "./teamDelegation";
import type { FunctionToolDescriptor } from "./types";
import { v0_code_generation } from "./v0_code_generation";
import { create_video } from "./video";
import { get_weather } from "./weather";
import { web_search } from "./web_search";

export type { FunctionToolDescriptor } from "./types";

export interface FunctionToolCatalogueOptions {
  connectedConnectorProviders?: readonly RecipeConnectorProvider[];
  selectedConnectorProvider?: RecipeConnectorProvider;
}

const descriptors: FunctionToolDescriptor[] = [
  get_weather,
  create_video,
  create_music,
  create_image,
  fill_in_middle_completion,
  next_edit_completion,
  apply_edit_completion,
  web_search,
  create_qr_code,
  search_pashi_tools,
  run_pashi_tools,
  call_api,
  research,
  search_documents,
  extract_content,
  search_memories,
  store_memory,
  create_note,
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
  v0_code_generation,
  delegateToTeamMember,
  delegateToTeamMemberByRole,
  getTeamMembers,
  discover_capabilities,
  set_goal,
  complete_goal,
  load_skill,
  run_council,
  select_council_members,
  second_opinion,
  get_hacker_news_stories,
  request_approval,
  ask_user,
  run_sandbox_task,
];

export function requireToolPermissions(name: string, permissions?: string[]): ToolPermission[] {
  const resolved = resolveToolPermissions(name, permissions);

  if (resolved.length === 0) {
    throw new AssistantError(
      `Tool "${name}" is missing explicit permissions`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return resolved;
}

export const functionToolDescriptors: FunctionToolDescriptor[] = descriptors.map((descriptor) => ({
  ...descriptor,
  permissions: requireToolPermissions(descriptor.name, descriptor.permissions),
}));

export function applyConnectorScope<T extends FunctionToolDescriptor>(
  definitions: readonly T[],
  options?: FunctionToolCatalogueOptions,
): T[] {
  if (!options?.connectedConnectorProviders && !options?.selectedConnectorProvider) {
    return [...definitions];
  }

  const connectedConnectorProviders = options.connectedConnectorProviders;
  const connectorProviders = options.selectedConnectorProvider
    ? !connectedConnectorProviders ||
      connectedConnectorProviders.includes(options.selectedConnectorProvider)
      ? [options.selectedConnectorProvider]
      : []
    : [...(connectedConnectorProviders ?? [])];

  return definitions.flatMap((definition) => {
    if (definition.name !== "use_recipe_connector") {
      return [definition];
    }

    if (connectorProviders.length === 0) {
      return [];
    }

    return [
      {
        ...definition,
        inputSchema: createUseRecipeConnectorInputSchema(connectorProviders),
      },
    ];
  });
}

export function listFunctionToolDefinitions(
  options?: FunctionToolCatalogueOptions,
): FunctionToolDescriptor[] {
  return applyConnectorScope(functionToolDescriptors, options);
}
