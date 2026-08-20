import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
  DEFERRED_TOOL_AUTO_THRESHOLD_BYTES,
  SKILL_LOAD_TOOL_NAME,
  capabilityDiscoveryResultSchema,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import { formatToolCalls } from "~/lib/chat/tools";
import {
  DeferredToolSession,
  type DeferredToolDefinition,
  type DeferredToolEntry,
} from "~/lib/tools/DeferredToolSession";
import { listFunctionTools } from "~/services/functions";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import type { CoreChatOptions, IUser, Message } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/toolLoading" });

const ASSISTANT_TOOL_GROUP = "Assistant tools";

const ALWAYS_INLINE_TOOL_NAMES = new Set<string>([
  CAPABILITY_DISCOVERY_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
  "ask_user",
  "request_approval",
  "set_goal",
  "complete_goal",
]);

export interface ToolLoadingResolution {
  tools?: Record<string, any>[];
  deferredTools?: DeferredToolSession;
}

export interface ToolLoadingInput {
  options: CoreChatOptions;
  enabledToolNames: string[] | undefined;
  user?: Pick<IUser, "id" | "plan_id">;
  provider: string;
  supportsToolCalls: boolean;
  connectedConnectorProviders?: RecipeConnectorProvider[];
}

export function collectLoadedToolNames(messages: readonly Message[]): string[] {
  const names: string[] = [];

  for (const message of messages) {
    if (message.role !== "tool" || message.name !== CAPABILITY_DISCOVERY_TOOL_NAME) {
      continue;
    }

    const result = capabilityDiscoveryResultSchema.safeParse(
      message.data?.[CAPABILITY_DISCOVERY_DATA_KEY],
    );

    if (!result.success) {
      continue;
    }

    for (const item of result.data.items) {
      if (item.kind === "tool" && item.invocation.availableNow) {
        names.push(item.invocation.toolName);
      }
    }
  }

  return names;
}

function measureInlineBytes(
  provider: string,
  definitions: readonly DeferredToolDefinition[],
): number {
  return JSON.stringify(formatToolCalls(provider, [...definitions])).length;
}

function inlineEntries(
  provider: string,
  requestTools: Record<string, any>[] | undefined,
  entries: readonly DeferredToolEntry[],
): Record<string, any>[] | undefined {
  if (entries.length === 0) {
    return requestTools;
  }

  return [
    ...(requestTools ?? []),
    ...formatToolCalls(
      provider,
      entries.map((entry) => entry.definition),
    ),
  ];
}

export function resolveToolLoading(input: ToolLoadingInput): ToolLoadingResolution {
  const { options, provider } = input;
  const externalEntries = options.deferred_tool_entries ?? [];

  if (!input.supportsToolCalls || options.disable_functions || options.response_format) {
    return { tools: options.tools };
  }

  const mode = options.tool_loading ?? "auto";

  if (mode === "eager") {
    return { tools: inlineEntries(provider, options.tools, externalEntries) };
  }

  const enabledToolNames = resolveEnabledFunctionToolNames(input.enabledToolNames, input.user);
  const entries: DeferredToolEntry[] = [
    ...externalEntries,
    ...listFunctionTools({
      connectedConnectorProviders: input.connectedConnectorProviders,
      selectedConnectorProvider: options.options?.connector?.provider,
    })
      .filter((tool) => enabledToolNames.has(tool.name) && !ALWAYS_INLINE_TOOL_NAMES.has(tool.name))
      .map((definition) => ({
        group: ASSISTANT_TOOL_GROUP,
        origin: "function" as const,
        definition,
      })),
  ];

  if (entries.length === 0) {
    return { tools: options.tools };
  }

  const inlineBytes = measureInlineBytes(
    provider,
    entries.map((entry) => entry.definition),
  );

  if (mode === "auto" && inlineBytes < DEFERRED_TOOL_AUTO_THRESHOLD_BYTES) {
    return { tools: inlineEntries(provider, options.tools, externalEntries) };
  }

  logger.info("Deferring tool definitions", {
    completion_id: options.completion_id,
    mode,
    deferred: entries.length,
    inlineBytes,
  });

  return { tools: options.tools, deferredTools: new DeferredToolSession(entries) };
}
