import type {
  ChatRun,
  TeammateConnectionGrant,
  TeammateContext,
  TeammateInvocation,
} from "@ngriffin_uk/polychat-schemas";
import {
  isLiveDelegationState,
  teammateRunConfigurationSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { parseRecipeInstallationRecord } from "~/services/apps/recipes";
import { requireConversationAccess } from "~/services/conversations/access";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  requireProjectTeammate,
  requireScopedTeammateAccess,
  requireTeammateAccess,
} from "./access";
import {
  ensureActiveTeammateContext,
  requireOwnedTeammateContext,
  requireTeammateContext,
} from "./contexts";

export interface ResolvedTeammateInvocation {
  invocation: TeammateInvocation;
  actorUserId: number;
  teammateId: string;
  context: TeammateContext | null;
  behaviour: "colleague" | "bot";
  projectId: string | null;
}

export interface PreparedTeammateRun {
  resolution: ResolvedTeammateInvocation;
  teammate: Teammate;
  connectionGrants: TeammateConnectionGrant[];
}

export async function prepareAdmittedTeammateContinuation(params: {
  context: ServiceContext;
  run: ChatRun;
  conversationId: string;
  teammateId: string;
}): Promise<PreparedTeammateRun> {
  const user = params.context.requireUser();
  const configuration = teammateRunConfigurationSchema.safeParse(params.run.resolvedConfiguration);

  if (
    !configuration.success ||
    configuration.data.teammateId !== params.teammateId ||
    params.run.initiatorUserId !== user.id ||
    params.run.conversationId !== params.conversationId
  ) {
    throw new AssistantError(
      "The admitted teammate run cannot be continued",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const teammateContext = params.run.teammateContextId
    ? await requireOwnedTeammateContext(params.context, params.run.teammateContextId)
    : null;
  const teammate = teammateContext
    ? await requireScopedTeammateAccess(
        params.context,
        params.teammateId,
        teammateContext.scope,
        user.id,
      )
    : await requireTeammateAccess(params.context, params.teammateId, "read", user.id);

  if (teammateContext && teammateContext.status !== "active") {
    throw new AssistantError("Teammate context is not active", ErrorType.FORBIDDEN, 403);
  }

  const invocation = configuration.data.invocation ?? {
    source: "conversation" as const,
    conversationId: params.conversationId,
  };

  if (invocation.source !== "conversation") {
    const prepared = await prepareTeammateRun({
      context: params.context,
      invocation,
      expectedTeammateId: params.teammateId,
      createContext: false,
    });
    const liveContextId = prepared.resolution.context?.id ?? null;

    if (liveContextId !== (params.run.teammateContextId ?? null)) {
      throw new AssistantError(
        "The teammate invocation authority changed before continuation",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return prepared;
  }

  const projectId = teammateContext
    ? teammateContext.scope.type === "project"
      ? teammateContext.scope.id
      : null
    : null;

  await requireConversationAccess(params.context, params.conversationId);

  return {
    resolution: {
      invocation,
      actorUserId: user.id,
      teammateId: teammate.id,
      context: teammateContext,
      behaviour: configuration.data.behaviour,
      projectId,
    },
    teammate,
    connectionGrants: teammateContext
      ? await params.context.repositories.teammateContexts.listConnectionGrants(teammateContext.id)
      : [],
  };
}

export async function resolveTeammateInvocation(
  context: ServiceContext,
  invocation: TeammateInvocation,
  options?: {
    expectedTeammateId?: string;
    createContext?: boolean;
    conversationProjectId?: string;
  },
): Promise<ResolvedTeammateInvocation> {
  const user = context.requireUser();

  switch (invocation.source) {
    case "conversation": {
      const homeContext = await context.repositories.teammateContexts.getByHomeConversationId(
        invocation.conversationId,
      );

      if (homeContext) {
        const teammateContext = await requireTeammateContext(context, homeContext.id);

        return {
          invocation,
          actorUserId: user.id,
          teammateId: teammateContext.teammateId,
          context: teammateContext,
          behaviour: "colleague",
          projectId: teammateContext.scope.type === "project" ? teammateContext.scope.id : null,
        };
      }

      if (!options?.expectedTeammateId) {
        throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
      }

      const conversation = await context.repositories.conversations.getConversation(
        invocation.conversationId,
      );
      const authorisedConversation = conversation
        ? await requireConversationAccess(context, invocation.conversationId)
        : null;
      const projectId =
        typeof authorisedConversation?.project_id === "string"
          ? authorisedConversation.project_id
          : (options.conversationProjectId ?? null);
      const teammateContext =
        options.createContext === false
          ? null
          : await ensureActiveTeammateContext(
              context,
              options.expectedTeammateId,
              projectId
                ? { type: "project", id: projectId }
                : { type: "personal", id: String(user.id) },
            );

      return {
        invocation,
        actorUserId: user.id,
        teammateId: options.expectedTeammateId,
        context: teammateContext,
        behaviour: "colleague",
        projectId,
      };
    }

    case "delegation": {
      const delegation = await context.repositories.delegations.getById(invocation.delegationId);
      const child = delegation
        ? await context.repositories.conversations.getConversation(delegation.childConversationId)
        : null;

      if (
        !delegation ||
        !isLiveDelegationState(delegation.state) ||
        !child ||
        child.user_id !== user.id
      ) {
        throw new AssistantError("Delegation not found", ErrorType.NOT_FOUND, 404);
      }

      const projectId = typeof child.project_id === "string" ? child.project_id : null;

      if (projectId) {
        await requireProjectAccess(context, projectId);
      }

      const teammateContext = await ensureActiveTeammateContext(
        context,
        delegation.teammateId,
        projectId ? { type: "project", id: projectId } : { type: "personal", id: String(user.id) },
      );

      return {
        invocation,
        actorUserId: user.id,
        teammateId: delegation.teammateId,
        context: teammateContext,
        behaviour: "bot",
        projectId,
      };
    }

    case "channel": {
      const binding = await context.repositories.channelBindings.getById(invocation.bindingId);

      if (!binding || !binding.enabled || !binding.teammate_id || binding.created_by !== user.id) {
        throw new AssistantError("Channel binding not found", ErrorType.NOT_FOUND, 404);
      }

      if (binding.scope_type === "personal" && binding.scope_id !== String(user.id)) {
        throw new AssistantError("Channel binding is unavailable", ErrorType.FORBIDDEN, 403);
      }

      if (binding.scope_type === "project") {
        await requireProjectAccess(context, binding.scope_id);
      }

      const projectId = binding.scope_type === "project" ? binding.scope_id : null;
      const teammateContext = await ensureActiveTeammateContext(
        context,
        binding.teammate_id,
        projectId ? { type: "project", id: projectId } : { type: "personal", id: String(user.id) },
      );

      return {
        invocation,
        actorUserId: user.id,
        teammateId: binding.teammate_id,
        context: teammateContext,
        behaviour: binding.interaction_mode === "direct" ? "colleague" : "bot",
        projectId,
      };
    }

    case "routine": {
      const installation = await context.repositories.templates.getTemplateById(
        invocation.installationId,
      );
      const parsedInstallation = installation ? parseRecipeInstallationRecord(installation) : null;
      const contextId = parsedInstallation?.teammateContextId ?? null;

      if (
        !installation ||
        installation.created_by_user_id !== user.id ||
        parsedInstallation?.status !== "active" ||
        !contextId
      ) {
        throw new AssistantError("Targeted routine not found", ErrorType.NOT_FOUND, 404);
      }

      const teammateContext = await requireTeammateContext(context, contextId);

      return {
        invocation,
        actorUserId: user.id,
        teammateId: teammateContext.teammateId,
        context: teammateContext,
        behaviour: "bot",
        projectId: teammateContext.scope.type === "project" ? teammateContext.scope.id : null,
      };
    }

    case "project_task": {
      const task = await context.repositories.projectTasks.getTaskById(invocation.taskId);

      if (!task || task.projectId !== invocation.projectId || !options?.expectedTeammateId) {
        throw new AssistantError("Project task not found", ErrorType.NOT_FOUND, 404);
      }

      await requireProjectAccess(context, invocation.projectId);
      const teammateContext = await ensureActiveTeammateContext(
        context,
        options.expectedTeammateId,
        { type: "project", id: invocation.projectId },
      );

      return {
        invocation,
        actorUserId: user.id,
        teammateId: options.expectedTeammateId,
        context: teammateContext,
        behaviour: "bot",
        projectId: invocation.projectId,
      };
    }
  }

  throw new AssistantError("Unsupported teammate invocation", ErrorType.PARAMS_ERROR, 400);
}

export async function prepareTeammateRun(params: {
  context: ServiceContext;
  invocation: TeammateInvocation;
  expectedTeammateId?: string;
  createContext?: boolean;
  conversationProjectId?: string;
}): Promise<PreparedTeammateRun> {
  const resolution = await resolveTeammateInvocation(params.context, params.invocation, {
    expectedTeammateId: params.expectedTeammateId,
    createContext: params.createContext,
    conversationProjectId: params.conversationProjectId,
  });

  if (resolution.context && resolution.context.status !== "active") {
    throw new AssistantError("Teammate context is not active", ErrorType.FORBIDDEN, 403);
  }

  if (params.expectedTeammateId && params.expectedTeammateId !== resolution.teammateId) {
    throw new AssistantError("Teammate invocation does not match", ErrorType.FORBIDDEN, 403);
  }

  const teammate = resolution.projectId
    ? await requireProjectTeammate(params.context, resolution.projectId, resolution.teammateId)
    : await requireTeammateAccess(
        params.context,
        resolution.teammateId,
        "read",
        resolution.actorUserId,
      );
  const connectionGrants = resolution.context
    ? await params.context.repositories.teammateContexts.listConnectionGrants(resolution.context.id)
    : [];

  return { resolution, teammate, connectionGrants };
}
