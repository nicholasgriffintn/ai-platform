import type { ChatRun, TeammateContext } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ensureConversationBrief } from "~/services/memory-documents";
import { requireProjectAccess } from "~/services/workspaces/access";
import type { CreateChatCompletionsResponse, IUser } from "~/types";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError } from "~/utils/errors";
import { extractChatCompletionText } from "~/utils/messages";

import { parseRecipeInstallationRecord } from "./index";

export async function ensureRecipeOccurrenceConversation(params: {
  context: ServiceContext;
  user: IUser;
  conversationId: string;
  title: string;
  projectId?: string;
}): Promise<void> {
  const existing = await params.context.repositories.conversations.getConversation(
    params.conversationId,
  );

  if (!existing) {
    await params.context.repositories.conversations.createConversation(
      params.conversationId,
      params.user.id,
      params.title,
      {
        type: "task",
        ...(params.projectId ? { project_id: params.projectId } : {}),
      },
    );
  } else if (
    existing.user_id !== params.user.id ||
    (typeof existing.project_id === "string" ? existing.project_id : undefined) !== params.projectId
  ) {
    throw new Error("Recipe occurrence conversation identity is already in use");
  }

  await ensureConversationBrief(params.context, params.conversationId);
}

export async function deliverRecipeOccurrenceToTeammateHome(params: {
  context: ServiceContext;
  user: IUser;
  teammateContext: TeammateContext;
  installationId: string;
  occurrenceId: string;
  conversationId: string;
  recipeTitle: string;
  response?: CreateChatCompletionsResponse;
  run?: ChatRun;
  summary?: string;
  failure?: string;
}): Promise<"delivered" | "skipped"> {
  const currentContext = await params.context.repositories.teammateContexts.getById(
    params.teammateContext.id,
  );

  if (
    !currentContext ||
    currentContext.actorUserId !== params.user.id ||
    currentContext.status !== "active" ||
    currentContext.homeConversationId !== params.teammateContext.homeConversationId ||
    currentContext.teammateId !== params.teammateContext.teammateId
  ) {
    return "skipped";
  }

  const installationRecord = await params.context.repositories.templates.getTemplateById(
    params.installationId,
  );
  const installation = installationRecord
    ? parseRecipeInstallationRecord(installationRecord)
    : null;

  if (
    !installation ||
    installation.userId !== params.user.id ||
    installation.status !== "active" ||
    installation.teammateContextId !== currentContext.id
  ) {
    return "skipped";
  }

  let project = null;

  if (currentContext.scope.type === "project") {
    try {
      await requireProjectAccess(params.context, currentContext.scope.id);
    } catch (error) {
      if (error instanceof AssistantError && [403, 404].includes(error.statusCode ?? 0)) {
        return "skipped";
      }

      throw error;
    }

    project = await params.context.repositories.workspaces.getProject(currentContext.scope.id);

    if (!project) {
      return "skipped";
    }
  }

  const runStatus = params.run?.status ?? params.response?.run?.run.status;
  const needsAttention =
    runStatus === "awaiting_approval" ||
    runStatus === "awaiting_input" ||
    runStatus === "awaiting_takeover";
  const phase = needsAttention ? "attention" : "result";
  const digest = await sha256Hex(
    `teammate-routine:${params.teammateContext.id}:${params.occurrenceId}:${phase}`,
  );
  const messageId = `routine_${phase}_${digest.slice(0, 40)}`;
  const summary =
    params.failure ??
    params.summary ??
    (params.response
      ? extractChatCompletionText(params.response, {
          fallback: "The routine finished without a text summary.",
        })
      : "The routine finished without a result summary.");
  const heading = params.failure
    ? "Routine failed"
    : needsAttention
      ? "Routine needs attention"
      : "Routine completed";
  const resultPath = project
    ? `/work/${encodeURIComponent(project.workspace_id)}/projects/${encodeURIComponent(project.id)}/chat/${encodeURIComponent(params.conversationId)}`
    : `/chat/${encodeURIComponent(params.conversationId)}`;

  await params.context.repositories.messages.createProjectedMessage(
    currentContext.homeConversationId,
    {
      id: messageId,
      role: "assistant",
      content: `**${heading}: ${params.recipeTitle}**\n\n${summary.slice(0, 1600)}\n\n[Open result](${resultPath})`,
      data: {
        platform: "api",
        data: {
          teammateActivity: {
            type: "routine",
            occurrenceId: params.occurrenceId,
            conversationId: params.conversationId,
            recipeTitle: params.recipeTitle,
            summary: summary.slice(0, 1600),
            status: params.failure ? "error" : (runStatus ?? "completed"),
          },
        },
      },
    },
  );
  await params.context.repositories.conversations.markUnreadForUser(
    currentContext.homeConversationId,
    params.user.id,
  );

  return "delivered";
}
