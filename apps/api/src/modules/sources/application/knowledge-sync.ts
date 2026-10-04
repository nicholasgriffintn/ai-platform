import { CONNECTOR_ACCOUNT_REFERENCE_KIND } from "@ngriffin_uk/polychat-ai-integrations";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  CONFLUENCE_KNOWLEDGE_RECIPE_ID,
  createKnowledgeSyncSchema,
  type CreateKnowledgeSync,
  type UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";

import { requireKnowledgeSyncAuthority } from "./knowledge-sync-access";
import { formatKnowledgeSync } from "./knowledge-sync-record";
import { enqueueKnowledgeSync } from "./knowledge-sync-tasks";

export async function listKnowledgeSyncs(context: ServiceContext, projectId: string) {
  await requireProjectAccess(context, projectId);
  const records = await context.repositories.knowledgeSyncs.list(projectId);

  return { syncs: records.map((record) => formatKnowledgeSync(record, context.requireUser().id)) };
}

export async function createKnowledgeSync(context: ServiceContext, input: CreateKnowledgeSync) {
  const parsed = createKnowledgeSyncSchema.parse(input);
  const userId = context.requireUser().id;

  await requireProjectCapabilityAccess(
    context,
    parsed.projectId,
    "recipe",
    CONFLUENCE_KNOWLEDGE_RECIPE_ID,
  );
  const connection = await context.repositories.providerConnections.getConnectionById(
    parsed.connectionId,
  );

  if (
    !connection ||
    connection.status !== "connected" ||
    !ownsResource(userId, connection.user_id) ||
    connection.provider !== "confluence" ||
    connection.kind !== CONNECTOR_ACCOUNT_REFERENCE_KIND
  ) {
    throw new AssistantError("Select a connected Confluence account", ErrorType.PARAMS_ERROR, 400);
  }

  for (const page of parsed.pages) {
    if (
      JSON.stringify(redactSensitiveTokens(page.readParameters)) !==
      JSON.stringify(page.readParameters)
    ) {
      throw new AssistantError(
        "Page parameters must not contain credentials",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  const id = generateId();

  await context.repositories.knowledgeSyncs.create({
    id,
    userId,
    projectId: parsed.projectId,
    connectionId: connection.id,
    title: parsed.title,
    pages: parsed.pages,
    intervalMinutes: parsed.intervalMinutes,
  });
  const saved = await context.repositories.knowledgeSyncs.get(id);

  if (!saved) {
    throw new AssistantError("Sync could not be saved", ErrorType.DATABASE_ERROR);
  }

  await enqueueKnowledgeSync(context.env, context.repositories, saved);

  return formatKnowledgeSync(saved, userId);
}

export async function controlKnowledgeSync(
  context: ServiceContext,
  id: string,
  input: UpdateKnowledgeSync,
) {
  const sync = await context.repositories.knowledgeSyncs.get(id);

  if (!sync || !ownsResource(context.requireUser().id, sync.user_id)) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  await requireProjectAccess(context, sync.project_id);
  if (input.action !== "pause") {
    await requireKnowledgeSyncAuthority(context, sync);
  }

  await context.repositories.knowledgeSyncs.control(id, input.action);
  const saved = await context.repositories.knowledgeSyncs.get(id);

  if (!saved) {
    throw new AssistantError("Knowledge sync not found", ErrorType.NOT_FOUND, 404);
  }

  if (input.action !== "pause") {
    await enqueueKnowledgeSync(context.env, context.repositories, saved);
  }

  return formatKnowledgeSync(saved, context.requireUser().id);
}
