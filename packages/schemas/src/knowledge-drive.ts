import z from "zod/v4";

export const driveKnowledgeCheckpointSchema = z
  .object({
    folders: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/))
      .min(1)
      .max(2000),
    folderIndex: z.number().int().nonnegative(),
    pageToken: z.string().max(4096).nullable(),
  })
  .strict();

export type DriveKnowledgeCheckpoint = z.infer<typeof driveKnowledgeCheckpointSchema>;

export const driveKnowledgeFileSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    name: z.string().min(1),
    mimeType: z.string(),
    modifiedTime: z.iso.datetime({ offset: true }),
    version: z.string().min(1).max(100),
    trashed: z.boolean().optional(),
    size: z.string().regex(/^\d+$/).optional(),
    webViewLink: z.url().optional(),
  })
  .passthrough();

export const driveKnowledgePageSchema = z
  .object({
    files: z.array(driveKnowledgeFileSchema).max(20),
    nextPageToken: z.string().max(4096).optional(),
    incompleteSearch: z.boolean().optional(),
  })
  .passthrough();

export const driveKnowledgePermissionsSchema = z
  .object({
    permissions: z
      .array(
        z
          .object({
            type: z.string(),
            role: z.string(),
            emailAddress: z.email().optional(),
            deleted: z.boolean().optional(),
            expirationTime: z.iso.datetime({ offset: true }).optional(),
          })
          .passthrough(),
      )
      .max(100),
    nextPageToken: z.string().max(4096).optional(),
  })
  .passthrough();

export type DriveKnowledgeFile = z.infer<typeof driveKnowledgeFileSchema>;
export const driveKnowledgeFolderSchema = z
  .object({
    id: z.string(),
    mimeType: z.literal("application/vnd.google-apps.folder"),
    trashed: z.boolean().optional(),
  })
  .passthrough();
