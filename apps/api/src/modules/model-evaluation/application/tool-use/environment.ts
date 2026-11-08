import {
  getToolDefinitionLikeName,
  type ToolDefinitionLike,
} from "@ngriffin_uk/polychat-ai-providers";
import { isToolDeclaration } from "@ngriffin_uk/polychat-library-tools";
import type {
  RecipeConnectorProvider,
  SkillAvailability,
  ToolUseEvalCase,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { buildRequestCapabilityMap } from "~/modules/assistant-capabilities/application/capability-map";
import { getRecipeConnectorProviderConfig } from "~/modules/connectors/application/connector-adapters";
import { getModelConfigByMatchingModel } from "~/modules/models/application/resolve";
import { getSystemPrompt } from "~/modules/responses/application/engine/prompts";
import { resolveAvailableFunctions } from "~/modules/responses/application/engine/tools/available-functions";
import {
  buildSkillAvailabilityInput,
  listSkillAvailability,
  mergeSkillLoadToolName,
  mergeSkillSuggestedToolNames,
} from "~/modules/skills/application";
import {
  resolveRequestFunctionToolNames,
  resolveSettingsDisabledToolNames,
  withoutSettingsDisabledTools,
} from "~/modules/tools/application/availability";

export interface ToolUseEnvironment {
  systemPrompt: string;
  functions: ToolDefinitionLike[];
  descriptions: ReadonlyMap<string, string>;
}

function connectedAppNames(providers: readonly RecipeConnectorProvider[]): string[] {
  return providers.flatMap((provider) => getRecipeConnectorProviderConfig(provider)?.name ?? []);
}

function toolDescription(tool: ToolDefinitionLike): [string, string] {
  return [
    getToolDefinitionLikeName(tool),
    (isToolDeclaration(tool) ? tool.function.description : tool.description) ?? "",
  ];
}

async function listCaseSkills(params: {
  supportsToolCalls: boolean;
  enabledTools: readonly string[] | undefined;
}): Promise<readonly SkillAvailability[]> {
  return listSkillAvailability(
    buildSkillAvailabilityInput({
      skillScope: { scope: "personal" },
      supportsToolCalls: params.supportsToolCalls,
      enabledToolIds: new Set(params.enabledTools ?? []),
    }),
  );
}

export async function prepareToolUseEnvironment(params: {
  context: ServiceContext;
  evalCase: ToolUseEvalCase;
  model: string;
  provider?: string;
}): Promise<ToolUseEnvironment> {
  const { context, evalCase, model, provider } = params;
  const { env } = context;
  const request = evalCase.setup.request;
  const user = context.requireUser();
  const modelConfig = await getModelConfigByMatchingModel(model, env, provider, user.id);
  const settingsDisabledTools = resolveSettingsDisabledToolNames({
    userSettings: null,
    explicitToolNames: request.enabledTools ?? [],
  });
  const requestTools = resolveRequestFunctionToolNames({
    requestedToolNames: request.enabledTools,
    toolSelectionMode: request.toolSelection,
    user,
  });
  const enabledTools =
    requestTools && withoutSettingsDisabledTools(requestTools, settingsDisabledTools);
  const skills = await listCaseSkills({
    supportsToolCalls: modelConfig?.supportsToolCalls ?? false,
    enabledTools,
  });
  const preparedTools = withoutSettingsDisabledTools(
    mergeSkillSuggestedToolNames({
      enabledTools: mergeSkillLoadToolName({ enabledTools: enabledTools ?? [], skills }),
      skills,
      deferSuggestedTools: enabledTools !== undefined,
    }),
    settingsDisabledTools,
  );
  const capabilityMap = buildRequestCapabilityMap(
    {
      env,
      user,
      mode: request.toolPolicy ?? request.mode,
      requestedToolNames: requestTools,
      settingsDisabledTools,
    },
    connectedAppNames(request.connectedApps),
  );
  const systemPrompt = await getSystemPrompt({
    request: {
      completion_id: `tool-use-eval:${evalCase.id}`,
      input: evalCase.prompt,
      model,
      provider,
      date: new Date().toISOString().split("T")[0],
      mode: request.mode,
      conversation_type: request.conversationType,
    },
    model,
    user,
    skills,
    capabilityMap,
  });
  const { available_functions } = resolveAvailableFunctions({
    enabled_tools: preparedTools,
    context,
    connectedConnectorProviders: request.connectedApps,
    mode: request.mode,
    tool_policy_mode: request.toolPolicy,
    conversation_type: request.conversationType,
    settings_disabled_tools: settingsDisabledTools,
  });

  return {
    systemPrompt,
    functions: available_functions,
    descriptions: new Map(available_functions.map(toolDescription)),
  };
}
