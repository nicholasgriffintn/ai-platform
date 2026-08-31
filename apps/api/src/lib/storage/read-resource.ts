import type { ServiceContext } from "~/lib/context/serviceContext";
import { isOutputDeletionPending } from "~/lib/outputs/deletion";
import { StorageService } from "~/lib/storage";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { PrivateFileResourceKind } from "./resource-urls";

interface PrivateFileRecord {
  created_by_user_id: number;
  project_id: string | null;
  conversation_id: string | null;
  storage_key: string | null;
  mime_type: string | null;
  filename: string | null;
  content?: string | Record<string, unknown> | null;
}

export type PrivateFileAccessScope = "project" | "owner" | "public-conversation" | "denied";

export function getPrivateFileAccessScope(
  record: PrivateFileRecord,
  userId?: number,
): PrivateFileAccessScope {
  if (record.project_id) {
    return userId ? "project" : "denied";
  }

  if (userId === record.created_by_user_id) {
    return "owner";
  }

  if (record.conversation_id) {
    return "public-conversation";
  }

  return "denied";
}

function isPublicConversation(value: unknown): boolean {
  return value === true || value === 1;
}

async function assertFileAccess(
  context: ServiceContext,
  record: PrivateFileRecord,
  userId?: number,
): Promise<void> {
  const scope = getPrivateFileAccessScope(record, userId);

  if (scope === "owner") {
    return;
  }

  if (scope === "project") {
    await requireProjectAccess(context, record.project_id);

    return;
  }

  if (scope === "public-conversation") {
    const conversation = await context.repositories.conversations.getConversation(
      record.conversation_id,
    );

    if (conversation && isPublicConversation(conversation.is_public)) {
      return;
    }
  }

  throw new AssistantError("Access denied", ErrorType.FORBIDDEN, 403);
}

function canRenderInline(mimeType: string | null): boolean {
  if (!mimeType) {
    return false;
  }

  return /^(?:image\/(?:avif|gif|jpeg|png|webp)|audio\/|video\/)/i.test(mimeType);
}

export async function readPrivateFile(params: {
  context: ServiceContext;
  kind: PrivateFileResourceKind;
  resourceId: string;
  userId?: number;
}) {
  const record =
    params.kind === "source"
      ? await params.context.repositories.sources.getSource(params.resourceId)
      : await params.context.repositories.outputs.getOutput(params.resourceId);

  if (
    !record ||
    (params.kind === "output" && isOutputDeletionPending(record)) ||
    !record.storage_key ||
    !record.mime_type
  ) {
    throw new AssistantError("File not found", ErrorType.NOT_FOUND, 404);
  }

  await assertFileAccess(params.context, record, params.userId);
  const object = await new StorageService(params.context.env.PRIVATE_ASSETS_BUCKET).getObjectBody(
    record.storage_key,
  );

  if (!object) {
    throw new AssistantError("File not found", ErrorType.NOT_FOUND, 404);
  }

  return { record, object };
}

export async function getPrivateFileResponse(
  record: PrivateFileRecord,
  object: { arrayBuffer(): Promise<ArrayBuffer> },
): Promise<Response> {
  const disposition = canRenderInline(record.mime_type) ? "inline" : "attachment";

  return new Response(await object.arrayBuffer(), {
    headers: {
      "Content-Type": record.mime_type || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${(record.filename || "file").replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
