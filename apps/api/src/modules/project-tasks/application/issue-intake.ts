import {
  createProjectTaskSchema,
  issueSnapshotSchema,
  type IssueLocator,
  type ImportProjectIssueInput,
  type IssueSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createSource } from "~/modules/sources/application/sources";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { getTaskIntegrationAdapter } from "../infrastructure/integrations";
import { createProjectTask } from "./index";
import { issueImportIdentity } from "./integration-identity";

export async function readProjectIssue(
  context: ServiceContext,
  projectId: string,
  locator: IssueLocator,
): Promise<IssueSnapshot> {
  await requireProjectAccess(context, projectId);
  const adapter = getTaskIntegrationAdapter(locator.provider);

  if (!adapter.readIssue) {
    throw new AssistantError(
      "This integration does not support issue import",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const { fields, upstreamRevision } = await adapter.readIssue(context, projectId, locator);

  return issueSnapshotSchema.parse({
    ...fields,
    revision: await sha256Hex(JSON.stringify([fields, upstreamRevision])),
    capturedAt: new Date().toISOString(),
  });
}

export async function previewProjectIssue(
  context: ServiceContext,
  projectId: string,
  locator: IssueLocator,
) {
  const issue = await readProjectIssue(context, projectId, locator);
  const identity = await issueImportIdentity(projectId, context.requireUser().id, issue);
  const existing = await context.repositories.projectTaskIntegrations.getImport(
    identity,
    projectId,
  );

  return { issue, existingTaskId: existing?.task_id ?? null };
}

export async function importProjectIssue(
  context: ServiceContext,
  projectId: string,
  input: ImportProjectIssueInput,
) {
  const issue = await readProjectIssue(context, projectId, input.locator);
  const identity = await issueImportIdentity(projectId, context.requireUser().id, issue);
  const existing = await context.repositories.projectTaskIntegrations.getImport(
    identity,
    projectId,
  );

  if (existing) {
    const task = await context.repositories.projectTasks.getTaskById(existing.task_id);

    if (!task || task.projectId !== projectId) {
      throw new AssistantError("Imported task is unavailable", ErrorType.NOT_FOUND, 404);
    }

    return { task, sourceId: existing.source_id, reused: true };
  }

  if (issue.revision !== input.expectedRevision) {
    throw new AssistantError(
      "The issue changed. Load it again before importing.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const sourceId = `issue_${identity}_${issue.revision}`;
  const taskInput = createProjectTaskSchema.parse({
    ...input.task,
    context: {
      notes: input.task.context?.notes ?? null,
      links: [
        { url: issue.url, label: issue.identifier.slice(0, 120) },
        ...(input.task.context?.links ?? []).filter((link) => link.url !== issue.url),
      ],
      sourceIds: [
        sourceId,
        ...(input.task.context?.sourceIds ?? []).filter((id) => id !== sourceId),
      ],
    },
  });

  await createSource(
    context,
    context.requireUser().id,
    {
      projectId,
      kind: "connector",
      status: "available",
      title: `${issue.identifier}: ${issue.title}`.slice(0, 200),
      provider: issue.provider,
      externalUri: issue.url,
      connectionId: issue.connectionId,
      content: `${issue.identifier}: ${issue.title}\n${issue.url}\nRevision: ${issue.revision}\nCaptured: ${issue.capturedAt}\n\n${issue.description}`,
      metadata: { immutableSnapshot: true, externalIssue: issue },
    },
    { id: sourceId },
  );
  const { task } = await createProjectTask(context, projectId, taskInput, {
    id: `issue_task_${identity}`,
  });
  const capturedSourceId = task.context?.sourceIds?.[0];

  if (!capturedSourceId) {
    throw new AssistantError("Imported task snapshot is missing", ErrorType.INTERNAL_ERROR);
  }

  const captured = await context.repositories.sources.getSource(capturedSourceId);

  if (!captured || captured.project_id !== projectId) {
    throw new AssistantError("Imported task snapshot is unavailable", ErrorType.INTERNAL_ERROR);
  }

  const savedIssue = issueSnapshotSchema.parse(parseJsonRecord(captured.metadata).externalIssue);

  const created = await context.repositories.projectTaskIntegrations.recordImport({
    id: identity,
    workspace_id: task.workspaceId,
    project_id: projectId,
    owner_user_id: context.requireUser().id,
    task_id: task.id,
    source_id: capturedSourceId,
    provider: savedIssue.provider,
    account_id: savedIssue.accountId,
    external_id: savedIssue.externalId,
    revision: savedIssue.revision,
  });
  const recorded = await context.repositories.projectTaskIntegrations.getImport(
    identity,
    projectId,
  );

  if (!recorded) {
    throw new AssistantError(
      "Imported task scope changed before intake was recorded",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return { task, sourceId: capturedSourceId, reused: !created || capturedSourceId !== sourceId };
}
