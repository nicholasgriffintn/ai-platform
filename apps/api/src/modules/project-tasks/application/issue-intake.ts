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
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/apps/application/connectors/operations";
import { createSource } from "~/modules/sources/application/sources";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { GitHubTaskClient } from "../infrastructure/GitHubTaskClient";
import { createProjectTask } from "./index";
import { issueImportIdentity } from "./integration-identity";

const linearIssueSchema = z.object({
  id: z.string().min(1),
  identifier: z.string().min(1),
  title: z.string().max(1000),
  description: z.string().max(100000).nullish(),
  url: z.url(),
  updatedAt: z.string(),
});
const linearResultSchema = z.object({ data: z.object({ issue: linearIssueSchema.nullable() }) });

interface IssueCapture {
  readonly fields: Omit<IssueSnapshot, "revision" | "capturedAt">;
  readonly upstreamRevision: string;
}

async function captureIssue(
  context: ServiceContext,
  projectId: string,
  locator: IssueLocator,
): Promise<IssueCapture> {
  if (locator.provider === "github") {
    const client = await GitHubTaskClient.forUser(
      context,
      locator.installationId,
      locator.repository,
    );
    const issue = await client.readIssue(locator.issueNumber);

    return {
      fields: {
        provider: "github",
        accountId: client.connectionId,
        externalId: String(issue.id),
        identifier: `${locator.repository}#${issue.number}`,
        title: issue.title,
        description: issue.body ?? "",
        url: issue.html_url,
      },
      upstreamRevision: issue.updated_at,
    };
  }

  try {
    const result = await executeRecipeConnectorOperation({
      context,
      userId: context.requireUser().id,
      request: {
        provider: "linear",
        operation: "LINEAR_GET_LINEAR_ISSUE",
        connectedAccountId: locator.connectedAccountId,
        params: { issue_id: locator.issueId },
      },
      scope: { completionId: context.connectorRunId, conversationId: null, projectId },
    });
    const parsed = linearResultSchema.safeParse(result);

    if (!parsed.success) {
      throw new AssistantError(
        "Linear returned an invalid issue",
        ErrorType.EXTERNAL_API_ERROR,
        502,
      );
    }

    const issue = parsed.data.data.issue;

    if (!issue) {
      throw new AssistantError("Linear issue is unavailable", ErrorType.NOT_FOUND, 404);
    }

    return {
      fields: {
        provider: "linear",
        accountId: locator.connectedAccountId,
        externalId: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? "",
        url: issue.url,
      },
      upstreamRevision: issue.updatedAt,
    };
  } finally {
    await closeComposioConnectorRun(context);
  }
}

export async function readProjectIssue(
  context: ServiceContext,
  projectId: string,
  locator: IssueLocator,
): Promise<IssueSnapshot> {
  await requireProjectAccess(context, projectId);
  const { fields, upstreamRevision } = await captureIssue(context, projectId, locator);

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
  const identity = await issueImportIdentity(projectId, issue);
  const existing = await context.repositories.projectTaskIntegrations.getImport(identity);

  return { issue, existingTaskId: existing?.task_id ?? null };
}

export async function importProjectIssue(
  context: ServiceContext,
  projectId: string,
  input: ImportProjectIssueInput,
) {
  const issue = await readProjectIssue(context, projectId, input.locator);
  const identity = await issueImportIdentity(projectId, issue);
  const existing = await context.repositories.projectTaskIntegrations.getImport(identity);

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
      ...(issue.provider === "github" ? { connectionId: issue.accountId } : {}),
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
    project_id: projectId,
    task_id: task.id,
    source_id: capturedSourceId,
    provider: savedIssue.provider,
    account_id: savedIssue.accountId,
    external_id: savedIssue.externalId,
    revision: savedIssue.revision,
  });

  return { task, sourceId: capturedSourceId, reused: !created || capturedSourceId !== sourceId };
}
