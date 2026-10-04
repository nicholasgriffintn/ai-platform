import {
  driveKnowledgeCheckpointSchema,
  driveKnowledgeFileSchema,
  driveKnowledgeFolderSchema,
} from "@ngriffin_uk/polychat-schemas";
import { readGoogleDriveFolderId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  getDriveKnowledgePermissions,
  listDriveKnowledgePage,
  readDriveKnowledgeContent,
  validateDriveKnowledgeVersion,
} from "./drive.js";
import { createKnowledgeProxyReader } from "./proxy.js";
import type { KnowledgeConnectorAdapter } from "./types.js";

export const googleDriveKnowledgeAdapter: KnowledgeConnectorAdapter = {
  capability: {
    rootLabel: "Drive folder link",
    rootPlaceholder: "https://drive.google.com/drive/folders/…",
    contentDescription:
      "Google Docs and text files are included, along with subfolders. Group-only sharing is excluded.",
  },
  createReader(credentials) {
    if (credentials.type !== "composio") {
      throw new AssistantError(
        "Drive requires a connected account",
        ErrorType.CONFIGURATION_ERROR,
        409,
      );
    }

    return createKnowledgeProxyReader(credentials.env, credentials.accountId, [
      { origin: "https://www.googleapis.com", pathPrefix: "/drive/v3/", methods: ["GET"] },
    ]);
  },
  normaliseRoot(value) {
    const rootId = readGoogleDriveFolderId(value);

    if (!rootId) {
      throw new AssistantError("Select a valid Drive folder link", ErrorType.PARAMS_ERROR, 400);
    }

    return rootId;
  },
  initialCheckpoint(rootId) {
    return { folders: [rootId], folderIndex: 0, pageToken: null };
  },
  async validateRoot(read, rootId) {
    const root = driveKnowledgeFolderSchema.parse(
      await read(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}?fields=id,mimeType,trashed&supportsAllDrives=true`,
      ),
    );

    if (root.trashed || root.id !== rootId) {
      throw new AssistantError("Select an accessible Drive folder", ErrorType.PARAMS_ERROR, 400);
    }
  },
  async listDocuments(read, checkpoint) {
    const result = await listDriveKnowledgePage(
      read,
      driveKnowledgeCheckpointSchema.parse(checkpoint),
    );

    return {
      documents: result.files.map((file) => ({
        id: file.id,
        title: file.name,
        version: file.version,
        sourceUrl: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
        data: file,
      })),
      checkpoint: result.checkpoint,
      complete: result.complete,
    };
  },
  getPermissions(read, document) {
    return getDriveKnowledgePermissions(read, driveKnowledgeFileSchema.parse(document.data).id);
  },
  async readContent(read, document, cachedContent) {
    const file = driveKnowledgeFileSchema.parse(document.data);

    if (cachedContent) {
      await validateDriveKnowledgeVersion(read, file);

      return cachedContent;
    }

    return readDriveKnowledgeContent(read, file);
  },
};
