import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseByteRange } from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { isOutputDeletionPending } from "~/modules/outputs/application/deletion";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

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

const DEFAULT_PRIVATE_CACHE_CONTROL = "private, max-age=300";

export const IMMUTABLE_PRIVATE_CACHE_CONTROL = "private, max-age=604800, immutable";

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
    const conversation = await context.repositories
      .get(ConversationRepository)
      .getConversation(record.conversation_id);

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
      ? await params.context.repositories.get(SourceRepository).getSource(params.resourceId)
      : await params.context.repositories.get(OutputRepository).getOutput(params.resourceId);

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
  record: Pick<PrivateFileRecord, "mime_type" | "filename">,
  object: { arrayBuffer(): Promise<ArrayBuffer> },
  rangeHeader?: string | null,
  cacheControl: string = DEFAULT_PRIVATE_CACHE_CONTROL,
): Promise<Response> {
  const disposition = canRenderInline(record.mime_type) ? "inline" : "attachment";
  const bytes = await object.arrayBuffer();
  const range = parseByteRange(rangeHeader, bytes.byteLength);
  const headers = {
    "Content-Type": record.mime_type || "application/octet-stream",
    "Content-Disposition": `${disposition}; filename="${(record.filename || "file").replace(/["\\\r\n]/g, "_")}"`,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  if (!range) {
    return new Response(bytes, { headers });
  }

  return new Response(bytes.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
    },
  });
}

export interface PrivateObjectFile {
  filename: string;
  mimeType: string;
  notFound?: string;
  cacheControl?: string;
}

export async function getPrivateObjectResponse(
  context: ServiceContext,
  key: string,
  file: PrivateObjectFile,
  rangeHeader?: string | null,
): Promise<Response> {
  const object = await StorageService.forPrivateAssets(context).getObjectBody(key);

  if (!object) {
    throw new AssistantError(file.notFound ?? "Not ready yet", ErrorType.NOT_FOUND, 404);
  }

  return getPrivateFileResponse(
    { mime_type: object.httpMetadata?.contentType ?? file.mimeType, filename: file.filename },
    object,
    rangeHeader,
    file.cacheControl,
  );
}
