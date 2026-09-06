import type {
  CreateOutputInput,
  Output,
  OutputHistoryResponse,
  OutputProvenance,
  OutputRevision,
  OutputShare,
  OutputSummary,
  ProvenanceSource,
  RestoreOutputRevisionInput,
  SharedOutput,
  UpdateOutputInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  isOutputDeletionPending,
  parseOutputContent as parseContent,
} from "~/lib/outputs/deletion";
import { createOutputProvenance, parseOutputProvenance } from "~/lib/provenance/output";
import type {
  OutputRecord,
  OutputRevisionRecord,
  OutputShareRecord,
} from "~/repositories/OutputRepository";
import { recordProjectAudit } from "~/services/audit";
import { requireSourceAccess } from "~/services/sources";
import { requireProjectAccess } from "~/services/workspaces/access";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId, randomHex } from "~/utils/id";

import { requireConversationScope, requireOutputAccess, requireOutputRecordAccess } from "./access";
import { deleteOutputResources } from "./delete-resources";
import { getOutputRestoreCapability } from "./revision-policy";

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
    provenance: parseOutputProvenance(record.provenance_json, record.created_at),
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
  const { content: _content, provenance: _provenance, ...summary } = formatOutput(record);

  return summary;
}

async function resolveProvenanceSourceAccess(
  context: ServiceContext,
  userId: number,
  provenance: OutputProvenance,
): Promise<OutputProvenance> {
  const sources = await Promise.all(
    provenance.sources.map(async (source): Promise<ProvenanceSource> => {
      try {
        await requireSourceAccess(context, userId, source.id);

        return { ...source, state: "referenced" };
      } catch (error) {
        if (
          error instanceof AssistantError &&
          (error.type === ErrorType.NOT_FOUND ||
            error.type === ErrorType.FORBIDDEN ||
            error.type === ErrorType.AUTHORISATION_ERROR)
        ) {
          return { ...source, state: "unavailable" };
        }

        throw error;
      }
    }),
  );

  return { ...provenance, sources };
}

function formatRevision(record: OutputRevisionRecord): OutputRevision {
  return {
    outputId: record.output_id,
    revision: record.revision,
    parentRevision: record.revision > 1 ? record.revision - 1 : null,
    title: record.title,
    status: record.status,
    sensitivity: record.sensitivity,
    content: parseContent(record.content),
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
    operation: record.operation ?? (record.revision === 1 ? "created" : "updated"),
    restoredFromRevision: record.restored_from_revision ?? null,
    provenance: parseOutputProvenance(record.provenance_json, record.created_at),
  };
}

function formatCurrentRevision(record: OutputRecord): OutputRevision {
  return {
    outputId: record.id,
    revision: record.revision,
    parentRevision: record.revision > 1 ? record.revision - 1 : null,
    title: record.title,
    status: record.status,
    sensitivity: record.sensitivity,
    content: parseContent(record.content),
    createdByUserId: record.revision_created_by_user_id ?? record.created_by_user_id,
    createdAt: record.revision_created_at ?? record.updated_at ?? record.created_at,
    operation: record.revision_operation ?? (record.revision === 1 ? "created" : "updated"),
    restoredFromRevision: record.restored_from_revision ?? null,
    provenance: parseOutputProvenance(record.provenance_json, record.created_at),
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
      provenance: createOutputProvenance({ origin: "user", completeness: "partial" }),
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
  const output = formatOutput(await requireOutputAccess(context, userId, outputId));

  return {
    ...output,
    provenance: await resolveProvenanceSourceAccess(context, userId, output.provenance),
  };
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

  const formatted = formatOutput(output);

  return {
    ...formatted,
    provenance: await resolveProvenanceSourceAccess(context, userId, formatted.provenance),
  };
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
): Promise<OutputHistoryResponse> {
  const output = await requireOutputAccess(context, userId, outputId);

  const revisions = await context.repositories.outputs.listRevisions(outputId);
  const current = formatCurrentRevision(output);

  return {
    current: {
      ...current,
      provenance: await resolveProvenanceSourceAccess(context, userId, current.provenance),
    },
    revisions: await Promise.all(
      revisions.map(async (revision) => {
        const formatted = formatRevision(revision);

        formatted.provenance = await resolveProvenanceSourceAccess(
          context,
          userId,
          formatted.provenance,
        );

        return formatted;
      }),
    ),
    restore: getOutputRestoreCapability(output),
  };
}

export async function restoreOutputRevision(
  context: ServiceContext,
  userId: number,
  outputId: string,
  revision: number,
  input: RestoreOutputRevisionInput,
): Promise<Output> {
  const current = await requireOutputAccess(context, userId, outputId, true);

  if (current.revision !== input.expectedRevision) {
    throw new AssistantError("Output has changed", ErrorType.CONFLICT_ERROR, 409);
  }

  const capability = getOutputRestoreCapability(current);

  if (!capability.supported) {
    throw new AssistantError(
      capability.reason ?? "This output cannot be restored",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (revision >= current.revision) {
    throw new AssistantError(
      "Only an earlier output revision can be restored",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const target = await context.repositories.outputs.getRevision(outputId, revision);

  if (!target) {
    throw new AssistantError("Output revision not found", ErrorType.NOT_FOUND, 404);
  }

  const project = current.project_id
    ? await context.repositories.workspaces.getProject(current.project_id)
    : null;

  if (current.project_id && !project) {
    throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
  }

  const restored = await context.repositories.outputs.updateOutput(
    outputId,
    {
      title: target.title,
      content: parseContent(target.content),
      expectedRevision: input.expectedRevision,
      updatedByUserId: userId,
      operation: "restored",
      restoredFromRevision: revision,
    },
    project
      ? {
          workspaceId: project.workspace_id,
          actorUserId: userId,
          action: "output.restored",
          outputId,
          metadata: { fromRevision: revision, toRevision: input.expectedRevision + 1 },
        }
      : undefined,
  );
  const formatted = formatOutput(restored);

  return {
    ...formatted,
    provenance: await resolveProvenanceSourceAccess(context, userId, formatted.provenance),
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
