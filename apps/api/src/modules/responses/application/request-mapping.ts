import {
  isStoredItem,
  itemsToMessages,
  resolveToolSelection,
  type EngineRequest,
  type ParsedCreateResponseRequest,
  type ResponseSettings,
  type StoredItem,
} from "@ngriffin_uk/polychat-schemas";
import { omitUndefinedProperties } from "@ngriffin_uk/polychat-utility-core";

import type { ResponseCommand } from "~/modules/responses/domain/command";

type CommandMessages = EngineRequest["messages"];
type CommandOptions = NonNullable<ResponseSettings["options"]>;

export interface ResponseCommandMappingOptions {
  platform?: string;
  poly?: boolean;
}

interface MappedInput {
  messages: CommandMessages;
  toolInteraction?: CommandOptions["toolInteraction"];
  connectorApprovalId?: string;
}

function mapInput(input: ParsedCreateResponseRequest["input"]): MappedInput {
  if (typeof input === "string") {
    return { messages: [{ role: "user", content: input }] };
  }

  const stored: StoredItem[] = [];
  let toolInteraction: CommandOptions["toolInteraction"];
  let connectorApprovalId: string | undefined;

  for (const item of input ?? []) {
    if (item.type === "interaction_response") {
      toolInteraction = { toolName: item.tool_name, response: item.response };
      continue;
    }

    if (item.type === "approval_response") {
      connectorApprovalId = item.approval_id;
      continue;
    }

    if (isStoredItem(item)) {
      stored.push(item);
    }
  }

  return {
    messages: itemsToMessages(stored) as CommandMessages,
    ...(toolInteraction ? { toolInteraction } : {}),
    ...(connectorApprovalId ? { connectorApprovalId } : {}),
  };
}

function mapConversation(conversation: ParsedCreateResponseRequest["conversation"]): {
  completionId?: string;
  conversationType?: ResponseCommand["conversationType"];
  projectId?: string;
  ephemeral: boolean;
} {
  if (conversation === null) {
    return { ephemeral: true };
  }

  if (typeof conversation === "string") {
    return { completionId: conversation, ephemeral: false };
  }

  if (!conversation) {
    return { ephemeral: false };
  }

  return {
    completionId: conversation.id,
    conversationType: conversation.type,
    projectId: conversation.project_id,
    ephemeral: false,
  };
}

function mapEnvironment(environment: ParsedCreateResponseRequest["environment"]): {
  computeSite?: ResponseSettings["compute_site"];
  sandbox?: CommandOptions["sandbox"];
} {
  if (!environment) {
    return {};
  }

  switch (environment.type) {
    case "hosted":
      return { computeSite: "hosted" };
    case "browser":
      return { computeSite: "browser" };
    case "device":
      return { computeSite: "device" };
    case "machine":
      return { computeSite: "machine" };
    case "sandbox": {
      const { type: _type, ...sandbox } = environment;

      void _type;

      return { computeSite: "hosted", sandbox: { enabled: true, ...sandbox } };
    }

    default:
      return {};
  }
}

export function toResponseCommand(
  request: ParsedCreateResponseRequest,
  options: ResponseCommandMappingOptions = {},
): ResponseCommand {
  const input = mapInput(request.input);
  const conversation = mapConversation(request.conversation);
  const environment = mapEnvironment(request.environment);
  const tools = resolveToolSelection(request.tools);
  const sampling = request.sampling ?? {};
  const metadata = omitUndefinedProperties({
    ...request.metadata,
    project_id: conversation.projectId ?? request.metadata?.project_id,
  });
  const commandOptions = omitUndefinedProperties({
    source: request.options?.source,
    recipe: request.options?.recipe,
    connector: request.options?.connector,
    agent: request.options?.agent,
    sandbox: environment.sandbox,
    toolInteraction: input.toolInteraction,
  });
  const settings = omitUndefinedProperties({
    system_prompt: request.instructions,
    model: request.model,
    models: request.models,
    use_multi_model: request.models?.length ? true : undefined,
    provider: request.provider,
    model_tier: request.model_tier,
    compute_site: environment.computeSite,
    enabled_tools: tools.enabledTools,
    approved_tools: tools.approvedTools,
    denied_tools: tools.deniedTools,
    tool_selection_mode: tools.toolSelectionMode,
    tools: tools.functionTools,
    tool_options: tools.hostedToolSettings,
    tool_choice: request.tool_choice,
    parallel_tool_calls: request.parallel_tool_calls,
    permission_mode: request.permission_mode,
    mode: request.mode,
    compaction: request.compaction,
    reasoning: request.reasoning,
    temperature: sampling.temperature,
    top_p: sampling.top_p,
    top_k: sampling.top_k,
    n: sampling.n,
    seed: sampling.seed,
    stop: sampling.stop,
    max_tokens: sampling.max_output_tokens,
    presence_penalty: sampling.presence_penalty,
    frequency_penalty: sampling.frequency_penalty,
    repetition_penalty: sampling.repetition_penalty,
    logit_bias: sampling.logit_bias,
    logprobs: sampling.logprobs,
    top_logprobs: sampling.top_logprobs,
    response_format: request.text?.format,
    verbosity: request.text?.verbosity,
    max_steps: request.budget?.steps,
    budget_constraint: request.budget?.credits,
    cache_ttl_seconds: request.cache_ttl_seconds,
    service_tier: request.service_tier,
    include_encrypted_reasoning: request.include?.includes("reasoning.encrypted")
      ? true
      : undefined,
    connector_approval_id: input.connectorApprovalId,
    platform: request.client?.platform ?? options.platform,
    poly: options.poly ? { ui_context: request.client?.ui_context } : undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    options: Object.keys(commandOptions).length > 0 ? commandOptions : undefined,
  });

  return {
    messages: input.messages,
    ...omitUndefinedProperties({
      conversationId: conversation.completionId,
      conversationType: conversation.conversationType,
      commandId: request.idempotency_key,
      runId: request.response_id,
      stream: request.stream,
      store: request.store ?? (conversation.ephemeral ? false : undefined),
    }),
    settings,
  };
}
