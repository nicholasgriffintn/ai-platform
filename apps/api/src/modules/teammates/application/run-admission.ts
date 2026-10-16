import type { ExecutionContext } from "@cloudflare/workers-types";
import { formatToolCalls } from "@ngriffin_uk/polychat-ai-providers";
import { operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import {
  isPolyTeammateId,
  PROJECT_TASK_INTERACTION_TOOL_IDS,
  teammateRunConfigurationSchema,
  readToolIds,
  type ChatRun,
  type ResponseAuthority,
  type ConversationType,
  type ParsedResponseCommand,
  type TeammateInvocation,
  type TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { intersectEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { resolveDelegationContinuation } from "~/modules/delegations/application/continuation";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { findModelConfig, getDefaultChatModel } from "~/modules/models/application/resolve";
import { recordPolyApprovalOutcome } from "~/modules/poly/application/earned-trust";
import {
  readToolInteractionId,
  readToolInteractionResolution,
} from "~/modules/responses/application/runs/interactions";
import { startResponse } from "~/modules/responses/application/start";
import { TeammateComputerRepository } from "~/modules/teammates/infrastructure/TeammateComputerRepository";
import { resolveChatProjectAccess } from "~/modules/workspaces/application/chatProjectAccess";
import type { IEnv, IUser } from "~/types";

import { requireTeammateAccess } from "./access";
import { prepareTeammateCompletionRequest } from "./completion-request";
import { buildTeammateCompletionTools, buildTeammatePersona } from "./completion-tools";
import { prepareAdmittedTeammateContinuation, prepareTeammateRun } from "./execution";
import { resolveTeammateMcpServers } from "./mcp-servers";
import { admitTeammateContextAuthority, requirePolyHomeRun } from "./poly-home";
import { prepareTeammateRunResume } from "./run-resume";
import { readTeammateSkillIds } from "./teammateResponse";

export interface TeammateRunAdmissionInput {
  env: IEnv;
  context?: ServiceContext;
  body: ParsedResponseCommand;
  teammateId: string;
  user: IUser | undefined;
  anonymousUser: any;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  conversationType?: ConversationType;
  authority?: ResponseAuthority;
  maxStepsOverride?: number;
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
  authority = {},
  maxStepsOverride,
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

  if (isPolyTeammateId(teammateId)) {
    requirePolyHomeRun(preparedInvocation?.resolution, body.completion_id);
  }

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
              operationIsGranted(admitted.allowedOperations, operation),
            ),
          },
        ];
      })
    : liveConnectionGrants;
  const delegation =
    resolvedInvocation?.source === "delegation"
      ? await serviceContext.repositories
          .get(DelegationRepository)
          .getById(resolvedInvocation.delegationId)
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
        memoryBindings: authority.delegationContext?.memoryBindings ?? delegation.memoryBindings,
        continuation: delegationContinuation,
      }
    : undefined;

  const functionSchemas = buildTeammateCompletionTools();
  const currentSkillIds = readTeammateSkillIds(teammate.skill_ids);
  const liveSkillIds = executionPolicy?.skillIds ?? currentSkillIds;
  const effectiveSkillIds = resumeConfiguration
    ? resumeConfiguration.skillIds.filter((skillId) => liveSkillIds.includes(skillId))
    : liveSkillIds;
  const currentEnabledTools = [
    ...new Set([
      ...(readToolIds(teammate.enabled_tools) ?? []),
      ...(resolvedInvocation?.source === "project_task" ? PROJECT_TASK_INTERACTION_TOOL_IDS : []),
    ]),
  ];
  const isPolyTeammate = isPolyTeammateId(teammate.id);
  const requestedEnabledTools = isPolyTeammate
    ? executionPolicy?.enabledTools
    : (executionPolicy?.enabledTools ?? body.enabled_tools);
  const liveEnabledTools = requestedEnabledTools
    ? intersectEnabledTools(currentEnabledTools, requestedEnabledTools)
    : currentEnabledTools;
  const effectiveEnabledTools =
    resumeConfiguration && !isPolyTeammate
      ? intersectEnabledTools(resumeConfiguration.enabledTools, liveEnabledTools)
      : liveEnabledTools;
  const effectiveBody = {
    ...body,
    ...(effectiveEnabledTools ? { enabled_tools: effectiveEnabledTools } : {}),
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
    ? await serviceContext.repositories
        .get(TeammateComputerRepository)
        .getByContextId(preparedInvocation.resolution.context.id)
    : null;
  const delegationDeadline =
    resumeConfiguration?.deadline ??
    (resolvedInvocation?.source === "delegation"
      ? (
          await serviceContext.repositories
            .get(DelegationRepository)
            .getById(resolvedInvocation.delegationId)
        )?.budget.deadline
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

  const response = await startResponse({
    env: serviceContext.env,
    authority: { ...authority, ...(delegationContext ? { delegationContext } : {}) },
    command: {
      ...requestParams,
      ...(conversationType ? { conversation_type: conversationType } : {}),
      ...(preparedInvocation?.resolution.context
        ? admitTeammateContextAuthority({
            context: preparedInvocation.resolution.context,
            trigger: authority.trigger,
            now: Date.now(),
          })
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
          : authority.durableExecution?.kind === "delegation"
            ? { maxCreditMicros: authority.durableExecution.maxCreditMicros }
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
  const run = await serviceContext.repositories
    .get(ConversationRunRepository)
    .getForInteraction(input.body.completion_id, interactionId);

  if (isPolyTeammateId(input.teammateId)) {
    await recordPolyApprovalOutcome({
      context: serviceContext,
      conversationId: input.body.completion_id,
      interactionId,
      options: input.body.options,
    });
  }

  const resume = await prepareTeammateRunResume({
    context: serviceContext,
    run,
    teammateId: input.teammateId,
    interactionId,
    resolution: readToolInteractionResolution(input.body.options),
  });

  return enqueueTeammateRun({
    ...input,
    context: serviceContext,
    ...(run ? { continuationRun: run } : {}),
    invocation: resume.configuration.invocation,
    maxStepsOverride: resume.maxSteps,
    resumeConfiguration: resume.configuration,
    authority: {
      ...input.authority,
      ...(resume.durableExecution ? { durableExecution: resume.durableExecution } : {}),
    },
  });
}
