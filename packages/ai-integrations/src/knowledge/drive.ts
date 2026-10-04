import {
  driveKnowledgeFileSchema,
  driveKnowledgePageSchema,
  driveKnowledgePermissionsSchema,
  sourceSyncCheckpointSchema,
  type DriveKnowledgeFile,
  type KnowledgeDocumentPermissions,
  type SourceSyncCheckpoint,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { KnowledgeProxyRead } from "./proxy.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOCUMENT_MIME = "application/vnd.google-apps.document";

export function isSupportedKnowledgeFile(file: DriveKnowledgeFile): boolean {
  return file.mimeType === DOCUMENT_MIME || file.mimeType.startsWith("text/");
}

export async function listDriveKnowledgePage(
  read: KnowledgeProxyRead,
  checkpoint: SourceSyncCheckpoint,
) {
  const folder = checkpoint.folders[checkpoint.folderIndex];

  if (!folder) {
    throw new AssistantError("Sync checkpoint is invalid", ErrorType.CONFIGURATION_ERROR, 409);
  }

  const query = new URLSearchParams({
    q: `'${folder}' in parents and trashed = false`,
    pageSize: "20",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields:
      "files(id,name,mimeType,modifiedTime,version,trashed,size,webViewLink),nextPageToken,incompleteSearch",
  });

  if (checkpoint.pageToken) {
    query.set("pageToken", checkpoint.pageToken);
  }

  const page = driveKnowledgePageSchema.parse(await read(`${DRIVE_API}/files?${query}`));

  if (page.incompleteSearch) {
    throw new AssistantError(
      "Drive returned an incomplete scan",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const folders = [
    ...new Set([
      ...checkpoint.folders,
      ...page.files.filter((file) => file.mimeType === FOLDER_MIME).map((file) => file.id),
    ]),
  ];
  const next = sourceSyncCheckpointSchema.parse({
    folders,
    folderIndex: checkpoint.folderIndex + (page.nextPageToken ? 0 : 1),
    pageToken: page.nextPageToken ?? null,
  });

  return {
    files: page.files.filter(isSupportedKnowledgeFile),
    checkpoint: next,
    complete: next.folderIndex >= folders.length,
  };
}

export async function getDriveKnowledgePermissions(
  read: KnowledgeProxyRead,
  fileId: string,
): Promise<KnowledgeDocumentPermissions> {
  const permissions: KnowledgeDocumentPermissions = { public: false, emails: [], validUntil: null };
  let cursor: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({
      fields: "permissions(type,role,emailAddress,deleted,expirationTime),nextPageToken",
      pageSize: "100",
      supportsAllDrives: "true",
    });

    if (cursor) {
      query.set("pageToken", cursor);
    }

    const result = driveKnowledgePermissionsSchema.parse(
      await read(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?${query}`),
    );

    for (const grant of result.permissions) {
      if (
        grant.deleted ||
        (grant.expirationTime && Date.parse(grant.expirationTime) <= Date.now())
      ) {
        continue;
      }

      if (
        !["reader", "commenter", "writer", "fileOrganizer", "organizer", "owner"].includes(
          grant.role,
        )
      ) {
        continue;
      }

      if (grant.type === "anyone") {
        permissions.public = true;
      }

      if (grant.type === "user" && grant.emailAddress) {
        permissions.emails.push(grant.emailAddress);
      }

      if (
        grant.expirationTime &&
        (!permissions.validUntil ||
          Date.parse(grant.expirationTime) < Date.parse(permissions.validUntil))
      ) {
        permissions.validUntil = grant.expirationTime;
      }
    }

    cursor = result.nextPageToken;
    if (!cursor) {
      return permissions;
    }
  }

  throw new AssistantError(
    "Drive permissions exceed the safe scan limit",
    ErrorType.CONFIGURATION_ERROR,
    409,
  );
}

export async function validateDriveKnowledgeVersion(
  read: KnowledgeProxyRead,
  file: DriveKnowledgeFile,
): Promise<void> {
  const current = driveKnowledgeFileSchema.parse(
    await read(
      `${DRIVE_API}/files/${encodeURIComponent(file.id)}?fields=id,name,mimeType,modifiedTime,version,size,trashed&supportsAllDrives=true`,
    ),
  );

  if (
    current.id !== file.id ||
    current.version !== file.version ||
    current.mimeType !== file.mimeType ||
    current.trashed
  ) {
    throw new AssistantError(
      "Knowledge document changed during sync",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}

export async function readDriveKnowledgeContent(
  read: KnowledgeProxyRead,
  file: DriveKnowledgeFile,
): Promise<string> {
  if (file.size && (!Number.isFinite(Number(file.size)) || Number(file.size) > 256 * 1024)) {
    throw new AssistantError(
      "Knowledge document exceeds the indexing size limit",
      ErrorType.PARAMS_ERROR,
      413,
    );
  }

  await validateDriveKnowledgeVersion(read, file);

  const endpoint =
    file.mimeType === DOCUMENT_MIME
      ? `${DRIVE_API}/files/${encodeURIComponent(file.id)}/export?mimeType=text%2Fplain`
      : `${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  const content = await read(endpoint);

  await validateDriveKnowledgeVersion(read, file);

  if (
    typeof content !== "string" ||
    new TextEncoder().encode(content).length > 256 * 1024 ||
    !content.trim()
  ) {
    throw new AssistantError(
      "Knowledge document has no supported text",
      ErrorType.PARAMS_ERROR,
      422,
    );
  }

  return content;
}
