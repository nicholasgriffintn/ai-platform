import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  teammateRunConfigurationSchema,
  readToolIds,
  type ChatRun,
  type ChatRunTrigger,
  type ConversationType,
  type ParsedChatCompletionRequestBody,
  type TeammateInvocation,
  type TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import { formatToolCalls } from "~/lib/chat/tools/provider-tool-definitions";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig, getDefaultChatModel } from "~/lib/providers/models";
import { readToolInteractionId } from "~/services/chat-runs/interactions";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { resolveDelegationContinuation } from "~/services/delegations/continuation";
import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { CoreChatOptions, IEnv, IUser } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { AssistantError, ErrorType } from "~/utils/errors";

import { requireTeammateAccess } from "./access";
import { prepareTeammateCompletionRequest } from "./completion-request";
import { buildTeammateCompletionTools, buildTeammatePersona } from "./completion-tools";
import { prepareAdmittedTeammateContinuation, prepareTeammateRun } from "./execution";
import { resolveTeammateMcpServers } from "./mcp-servers";
import { prepareTeammateRunResume } from "./run-resume";
import { readTeammateSkillIds } from "./teammateResponse";

export interface TeammateRunAdmissionInput {
  env: IEnv;
  context?: ServiceContext;
  body: ParsedChatCompletionRequestBody;
  teammateId: string;
  user: IUser | undefined;
  anonymousUser: any;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  conversationType?: ConversationType;
  trigger?: ChatRunTrigger;
  maxStepsOverride?: number;
  durableExecution?: CoreChatOptions["durable_execution"];
  invocation?: TeammateInvocation;
  resumeConfiguration?: TeammateRunConfiguration;
  executionPolicy?: {
    model?: string | null;
    mode?: string;
    skillIds?: string[];
    enabledTools?: string[];
  };
  continuationRun?: ChatRun;
}

export async function enqueueTeammateRun({
  env,
  context,
  body,
  teammateId,
  user,
  anonymousUser,
  executionCtx,
  signal,
  conversationType,
  trigger,
  maxStepsOverride,
  durableExecution,
  invocation,
  resumeConfiguration,
  executionPolicy,
  continuationRun,
}: TeammateRunAdmissionInput) {
  const serviceContext =
    context ??
    createServiceContext({
      env,
      user,
    });

  serviceContext.ensureDatabase();

  const continuationConfiguration = continuationRun
    ? teammateRunConfigurationSchema.safeParse(continuationRun.resolvedConfiguration)
    : null;
  const resolvedInvocation =
    invocation ??
    (continuationConfiguration?.success ? continuationConfiguration.data.invocation : undefined) ??
    (user
      ? ({
          source: "conversation",
          conversationId: body.completion_id,
        } as const)
      : undefined);
  const conversationProjectAccess =
    resolvedInvocation?.source === "conversation"
      ? await resolveChatProjectAccess(serviceContext, body)
      : null;
  const preparedInvocation = continuationRun
    ? await prepareAdmittedTeammateContinuation({
        context: serviceContext,
        run: continuationRun,
        conversationId: body.completion_id,
        teammateId,
      })
    : resolvedInvocation
      ? await prepareTeammateRun({
          context: serviceContext,
          invocation: resolvedInvocation,
          expectedTeammateId: teammateId,
          createContext: body.store !== false,
          conversationProjectId: conversationProjectAccess?.project.id,
        })
      : null;
  const teammate =
    preparedInvocation?.teammate ??
    (await requireTeammateAccess(serviceContext, teammateId, "read", user?.id));
  const liveMcpServers = resolveTeammateMcpServers(teammate.servers);
  const mcpServers = resumeConfiguration
    ? resumeConfiguration.mcpServers.filter((admitted) =>
        liveMcpServers.some(
          (current) => current.label === admitted.label && current.url === admitted.url,
        ),
      )
    : liveMcpServers;
  const liveConnectionGrants = preparedInvocation?.connectionGrants ?? [];
  const connectionGrants = resumeConfiguration
    ? resumeConfiguration.connectionGrants.flatMap((admitted) => {
        const current = liveConnectionGrants.find(
          (grant) =>
            grant.id === admitted.id &&
            grant.connectionId === admitted.connectionId &&
            grant.revision === admitted.revision,
        );

        if (!current) {
          return [];
        }

        return [
          {
            ...current,
            allowedOperations: current.allowedOperations.filter((operation) =>
              admitted.allowedOperations.includes(operation),
            ),
          },
        ];
      })
    : liveConnectionGrants;
  const delegation =
    resolvedInvocation?.source === "delegation"
      ? await serviceContext.repositories.delegations.getById(resolvedInvocation.delegationId)
      : null;

  if (
    resolvedInvocation?.source === "delegation" &&
    (!delegation || delegation.childConversationId !== body.completion_id)
  ) {
    throw new AssistantError(
      "Delegation does not match this conversation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const delegationContinuation = delegation
    ? await resolveDelegationContinuation(serviceContext, delegation)
    : undefined;
  const delegationContext = delegation
    ? {
        delegationId: delegation.id,
        depth: delegation.depth,
        rootConversationId: delegation.parentConversationId,
        memoryBindings: delegation.memoryBindings,
        continuation: delegationContinuation,
      }
    : undefined;

  const functionSchemas = buildTeammateCompletionTools();
  const currentSkillIds = readTeammateSkillIds(teammate.skill_ids);
  const liveSkillIds = executionPolicy?.skillIds ?? currentSkillIds;
  const effectiveSkillIds = resumeConfiguration
    ? resumeConfiguration.skillIds.filter((skillId) => liveSkillIds.includes(skillId))
    : liveSkillIds;
  const currentEnabledTools = readToolIds(teammate.enabled_tools) ?? [];
  const requestedEnabledTools = executionPolicy?.enabledTools ?? body.enabled_tools;
  const liveEnabledTools = requestedEnabledTools
    ? intersectEnabledTools(currentEnabledTools, requestedEnabledTools)
    : currentEnabledTools;
  const effectiveEnabledTools = resumeConfiguration
    ? intersectEnabledTools(resumeConfiguration.enabledTools, liveEnabledTools)
    : liveEnabledTools;
  const effectiveBody = {
    ...body,
    ...(effectiveEnabledTools ? { enabled_tools: effectiveEnabledTools } : {}),
    ...(delegationContext ? { delegation_context: delegationContext } : {}),
  };
  const effectiveTeammate = {
    ...teammate,
    ...(resumeConfiguration?.model
      ? { model: resumeConfiguration.model }
      : executionPolicy?.model !== undefined
        ? { model: executionPolicy.model }
        : {}),
    enabled_tools: effectiveEnabledTools,
    skill_ids: effectiveSkillIds,
  };

  const requestedModel = effectiveTeammate.model || effectiveBody.model || undefined;
  const fallbackModel = requestedModel
    ? undefined
    : await getDefaultChatModel(serviceContext.env, user);
  const modelToUse = requestedModel ?? fallbackModel?.model;
  const modelDetails = await findModelConfig(
    modelToUse || "",
    env,
    body.provider ?? fallbackModel?.provider,
    user?.id,
  );

  if (!modelDetails) {
    throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
  }

  if (mcpServers.length > 0 && !modelDetails.supportsMcp) {
    throw new AssistantError(
      "This teammate has MCP servers, but its selected model does not support hosted MCP tools",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const formattedTools = formatToolCalls(modelDetails.provider, functionSchemas);
  const teammateComputer = preparedInvocation?.resolution.context
    ? await serviceContext.repositories.teammateComputers.getByContextId(
        preparedInvocation.resolution.context.id,
      )
    : null;
  const delegationDeadline =
    resumeConfiguration?.deadline ??
    (resolvedInvocation?.source === "delegation"
      ? (await serviceContext.repositories.delegations.getById(resolvedInvocation.delegationId))
          ?.budget.deadline
      : undefined);

  const requestParams = prepareTeammateCompletionRequest({
    teammate: effectiveTeammate,
    body: effectiveBody,
    modelProvider: modelDetails.provider,
    formattedTools,
    persona:
      resumeConfiguration?.persona ??
      buildTeammatePersona(teammate, preparedInvocation?.resolution.behaviour ?? "colleague"),
    mcpServers,
    maxStepsOverride,
    modeOverride: resumeConfiguration?.mode ?? executionPolicy?.mode,
  });

  const response = await handleCreateChatCompletions({
    env: serviceContext.env,
    request: {
      ...requestParams,
      ...(conversationType ? { conversation_type: conversationType } : {}),
      ...(trigger ? { trigger } : {}),
      ...(durableExecution ? { durable_execution: durableExecution } : {}),
      ...(preparedInvocation?.resolution.context
        ? { teammate_context_id: preparedInvocation.resolution.context.id }
        : {}),
      ...(teammateComputer ? { computer_id: teammateComputer.id } : {}),
      ...(resolvedInvocation?.source === "delegation"
        ? { delegation_id: resolvedInvocation.delegationId }
        : {}),
      resolved_configuration: {
        teammateId: teammate.id,
        behaviour: preparedInvocation?.resolution.behaviour ?? "colleague",
        ...(resolvedInvocation ? { invocation: resolvedInvocation } : {}),
        persona: requestParams.persona,
        model: modelDetails.matchingModel,
        mode: requestParams.mode,
        skillIds: effectiveSkillIds,
        enabledTools: requestParams.enabled_tools ?? [],
        memoryBindings: delegationContext?.memoryBindings ?? [],
        ...(delegationContinuation ? { delegationContinuation } : {}),
        mcpServers,
        connectionGrants:
          connectionGrants.map((grant) => ({
            id: grant.id,
            connectionId: grant.connectionId,
            revision: grant.revision,
            allowedOperations: grant.allowedOperations,
          })) ?? [],
        maxSteps: resumeConfiguration?.maxSteps ?? requestParams.max_steps ?? 20,
        usedSteps: resumeConfiguration?.usedSteps ?? 0,
        ...(resumeConfiguration?.maxCreditMicros !== undefined
          ? { maxCreditMicros: resumeConfiguration.maxCreditMicros }
          : durableExecution?.kind === "delegation"
            ? { maxCreditMicros: durableExecution.maxCreditMicros }
            : {}),
        ...(delegationDeadline ? { deadline: delegationDeadline } : {}),
      },
    },
    user,
    anonymousUser,
    context: serviceContext,
    executionCtx,
    signal,
  });

  return response;
}

export async function resumeTeammateRun(input: TeammateRunAdmissionInput) {
  const interactionId = readToolInteractionId(input.body.options);

  if (!interactionId) {
    throw new AssistantError(
      "A teammate run can only resume from a stored interaction response",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const serviceContext =
    input.context ??
    createServiceContext({
      env: input.env,
      user: input.user,
    });

  serviceContext.ensureDatabase();
  const run = await serviceContext.repositories.conversationRuns.getForInteraction(
    input.body.completion_id,
    interactionId,
  );
  const resume = await prepareTeammateRunResume({
    context: serviceContext,
    run,
    teammateId: input.teammateId,
  });

  return enqueueTeammateRun({
    ...input,
    context: serviceContext,
    ...(run ? { continuationRun: run } : {}),
    invocation: resume.configuration.invocation,
    maxStepsOverride: resume.maxSteps,
    resumeConfiguration: resume.configuration,
    ...(resume.durableExecution ? { durableExecution: resume.durableExecution } : {}),
  });
}
