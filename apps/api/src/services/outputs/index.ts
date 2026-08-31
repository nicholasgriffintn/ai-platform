import type {
  CreateOutputInput,
  Output,
  OutputRevision,
  OutputShare,
  OutputSummary,
  SharedOutput,
  UpdateOutputInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  isOutputDeletionPending,
  parseOutputContent as parseContent,
} from "~/lib/outputs/deletion";
import type {
  OutputRecord,
  OutputRevisionRecord,
  OutputShareRecord,
} from "~/repositories/OutputRepository";
import { recordProjectAudit } from "~/services/audit";
import { requireProjectAccess } from "~/services/workspaces/access";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId, randomHex } from "~/utils/id";

import { requireConversationScope, requireOutputAccess, requireOutputRecordAccess } from "./access";
import { deleteOutputResources } from "./delete-resources";

function formatFile(record: OutputRecord): Output["file"] {
  if (!record.storage_key || !record.mime_type) {
    return null;
  }

  return {
    key: record.storage_key,
    mimeType: record.mime_type,
    filename: record.filename,
    byteSize: record.byte_size,
  };
}

export function formatOutput(record: OutputRecord): Output {
  return {
    id: record.id,
    createdByUserId: record.created_by_user_id,
    projectId: record.project_id,
    conversationId: record.conversation_id,
    parentOutputId: record.parent_output_id,
    capabilityId: record.capability_id,
    groupId: record.group_id,
    kind: record.kind,
    title: record.title,
    status: record.status,
    sensitivity: record.sensitivity,
    content: parseContent(record.content),
    file: formatFile(record),
    revision: record.revision,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function formatSharedOutput(record: OutputRecord): SharedOutput {
  const output = formatOutput(record);

  return {
    id: output.id,
    capabilityId: output.capabilityId,
    kind: output.kind,
    title: output.title,
    status: output.status,
    content: output.content,
    file: output.file
      ? {
          mimeType: output.file.mimeType,
          filename: output.file.filename,
          byteSize: output.file.byteSize,
        }
      : null,
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
  };
}

function formatOutputSummary(record: OutputRecord): OutputSummary {
  const { content: _content, ...summary } = formatOutput(record);

  return summary;
}

function formatRevision(record: OutputRevisionRecord): OutputRevision {
  return {
    outputId: record.output_id,
    revision: record.revision,
    title: record.title,
    status: record.status,
    sensitivity: record.sensitivity,
    content: parseContent(record.content),
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
  };
}

function formatShare(record: OutputShareRecord): OutputShare {
  return {
    id: record.id,
    outputId: record.output_id,
    permission: record.permission,
    expiresAt: record.expires_at,
    revokedAt: record.revoked_at,
    createdAt: record.created_at,
  };
}

export async function createOutput(
  context: ServiceContext,
  userId: number,
  input: CreateOutputInput,
  options: { id?: string } = {},
): Promise<Output> {
  let workspaceId: string | undefined;

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId);
    workspaceId = (await context.repositories.workspaces.getProject(input.projectId))?.workspace_id;

    if (!workspaceId) {
      throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
    }
  }

  if (input.conversationId) {
    await requireConversationScope(context, userId, input.conversationId, input.projectId);
  }

  if (input.parentOutputId) {
    const parent = await requireOutputAccess(context, userId, input.parentOutputId);

    if (parent.project_id !== (input.projectId ?? null)) {
      throw new AssistantError("Parent output is outside this scope", ErrorType.PARAMS_ERROR, 400);
    }
  }

  const outputId = options.id ?? generateId();
  const created = await context.repositories.outputs.createOutput(
    {
      id: outputId,
      createdByUserId: userId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      parentOutputId: input.parentOutputId,
      capabilityId: input.capabilityId,
      groupId: input.groupId,
      kind: input.kind,
      title: input.title,
      status: input.status,
      sensitivity: input.sensitivity,
      content: input.content,
      storageKey: input.file?.key,
      mimeType: input.file?.mimeType,
      filename: input.file?.filename,
      byteSize: input.file?.byteSize,
    },
    workspaceId
      ? {
          workspaceId,
          actorUserId: userId,
          action: "output.created",
          outputId,
          metadata: { capabilityId: input.capabilityId, kind: input.kind },
        }
      : undefined,
  );

  return formatOutput(created);
}

export async function getOutput(
  context: ServiceContext,
  userId: number,
  outputId: string,
): Promise<Output> {
  return formatOutput(await requireOutputAccess(context, userId, outputId));
}

export async function getOutputIncludingDeleting(
  context: ServiceContext,
  userId: number,
  outputId: string,
): Promise<Output> {
  const output = await context.repositories.outputs.getOutputIncludingDeleting(outputId);

  if (!output) {
    throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(context, userId, output);

  return formatOutput(output);
}

export async function listOutputs(
  context: ServiceContext,
  userId: number,
  filters: {
    projectId?: string;
    capabilityId?: string;
    kind?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ outputs: OutputSummary[] }> {
  const pagination = {
    kind: filters.kind,
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  };
  const records = filters.projectId
    ? (await requireProjectAccess(context, filters.projectId),
      await context.repositories.outputs.listProjectOutputs(
        filters.projectId,
        filters.capabilityId,
        pagination,
      ))
    : await context.repositories.outputs.listPersonalOutputs(
        userId,
        filters.capabilityId,
        pagination,
      );

  return {
    outputs: records.filter((record) => !isOutputDeletionPending(record)).map(formatOutputSummary),
  };
}

export async function updateOutput(
  context: ServiceContext,
  userId: number,
  outputId: string,
  input: UpdateOutputInput,
): Promise<Output> {
  const existing = await requireOutputAccess(context, userId, outputId, true);
  const project = existing.project_id
    ? await context.repositories.workspaces.getProject(existing.project_id)
    : null;

  if (existing.project_id && !project) {
    throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
  }

  const updated = await context.repositories.outputs.updateOutput(
    outputId,
    {
      ...input,
      updatedByUserId: userId,
    },
    project
      ? {
          workspaceId: project.workspace_id,
          actorUserId: userId,
          action: "output.updated",
          outputId,
          metadata: { revision: existing.revision + 1 },
        }
      : undefined,
  );

  return formatOutput(updated);
}

export async function deleteOutput(
  context: ServiceContext,
  userId: number,
  outputId: string,
): Promise<void> {
  await deleteOutputResources(context, userId, outputId);
}

export async function listOutputRevisions(
  context: ServiceContext,
  userId: number,
  outputId: string,
): Promise<{ revisions: OutputRevision[] }> {
  await requireOutputAccess(context, userId, outputId);

  return {
    revisions: (await context.repositories.outputs.listRevisions(outputId)).map(formatRevision),
  };
}

export async function createOutputShare(
  context: ServiceContext,
  userId: number,
  outputId: string,
  expiresAt?: string | null,
): Promise<{ share: OutputShare; token: string }> {
  const output = await requireOutputAccess(context, userId, outputId, true);
  const token = randomHex(32);
  const share = await context.repositories.outputs.createShare({
    id: generateId(),
    outputId,
    tokenHash: await sha256Hex(token),
    createdByUserId: userId,
    expiresAt,
  });

  if (output.project_id) {
    await recordProjectAudit(context, output.project_id, {
      actorUserId: userId,
      action: "output.share.created",
      targetType: "output_share",
      targetId: share.id,
      metadata: { outputId, expiresAt: expiresAt ?? null },
    });
  }

  return { share: formatShare(share), token };
}

export async function listOutputShares(
  context: ServiceContext,
  userId: number,
  outputId: string,
): Promise<{ shares: OutputShare[] }> {
  await requireOutputAccess(context, userId, outputId, true);
  const now = Date.now();
  const shares = (await context.repositories.outputs.listShares(outputId)).filter(
    (share) =>
      !share.revoked_at && (!share.expires_at || new Date(share.expires_at).getTime() > now),
  );

  return { shares: shares.map(formatShare) };
}

export async function revokeOutputShare(
  context: ServiceContext,
  userId: number,
  outputId: string,
  shareId: string,
): Promise<void> {
  const output = await requireOutputAccess(context, userId, outputId, true);

  await context.repositories.outputs.revokeShare(outputId, shareId);
  if (output.project_id) {
    await recordProjectAudit(context, output.project_id, {
      actorUserId: userId,
      action: "output.share.revoked",
      targetType: "output_share",
      targetId: shareId,
      metadata: { outputId },
    });
  }
}

export async function getSharedOutput(
  context: ServiceContext,
  token: string,
): Promise<SharedOutput> {
  return formatSharedOutput(await getSharedOutputRecord(context, token));
}

export async function getSharedOutputRecord(
  context: ServiceContext,
  token: string,
): Promise<OutputRecord> {
  const share = await context.repositories.outputs.getShareByTokenHash(await sha256Hex(token));

  if (
    !share ||
    share.revoked_at ||
    (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())
  ) {
    throw new AssistantError("Shared output not found", ErrorType.NOT_FOUND, 404);
  }

  const output = await context.repositories.outputs.getOutput(share.output_id);

  if (!output || output.status === "archived" || isOutputDeletionPending(output)) {
    throw new AssistantError("Shared output not found", ErrorType.NOT_FOUND, 404);
  }

  return output;
}
