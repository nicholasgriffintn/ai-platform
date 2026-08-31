import z from "zod/v4";

const EMBEDDING_CONTENT_MAX_BYTES = 256 * 1024;
const EMBEDDING_METADATA_MAX_BYTES = 8 * 1024;
const EMBEDDING_METADATA_MAX_DEPTH = 4;
const EMBEDDING_METADATA_MAX_KEYS = 64;
const EMBEDDING_METADATA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const EMBEDDING_SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const EMBEDDING_SAFE_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const RESERVED_EMBEDDING_METADATA_KEYS = [
  "chunkId",
  "chunkIndex",
  "content",
  "contentType",
  "documentId",
  "embeddingModel",
  "fileData",
  "id",
  "lifecycleStatus",
  "mimeType",
  "namespace",
  "provider",
  "providerTarget",
  "scopeTag",
  "title",
  "type",
  "userId",
  "vectorSpace",
  "vectorSpaceVersion",
] as const;

const reservedEmbeddingMetadataKeys = new Set<string>(RESERVED_EMBEDDING_METADATA_KEYS);
const utf8Length = (value: string) => new TextEncoder().encode(value).byteLength;

const isValidEmbeddingMetadata = (metadata: Record<string, unknown>): boolean => {
  let keyCount = 0;

  const visit = (value: unknown, depth: number): boolean => {
    if (depth > EMBEDDING_METADATA_MAX_DEPTH) {
      return false;
    }

    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length <= 128 && value.every((item) => visit(item, depth + 1));
    }

    if (typeof value !== "object") {
      return false;
    }

    return Object.entries(value).every(([key, nested]) => {
      keyCount += 1;

      return (
        keyCount <= EMBEDDING_METADATA_MAX_KEYS &&
        EMBEDDING_METADATA_KEY_PATTERN.test(key) &&
        !reservedEmbeddingMetadataKeys.has(key) &&
        visit(nested, depth + 1)
      );
    });
  };

  return visit(metadata, 1);
};

const embeddingMetadataSchema = z.record(z.string(), z.unknown()).superRefine((metadata, ctx) => {
  if (!isValidEmbeddingMetadata(metadata)) {
    ctx.addIssue({
      code: "custom",
      message: "Embedding metadata contains invalid or reserved fields",
    });

    return;
  }

  let serialised: string;

  try {
    serialised = JSON.stringify(metadata);
  } catch {
    ctx.addIssue({ code: "custom", message: "Embedding metadata must be valid JSON" });

    return;
  }

  if (utf8Length(serialised) > EMBEDDING_METADATA_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: "Embedding metadata exceeds 8 KiB" });
  }
});

const embeddingTypeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(EMBEDDING_SAFE_TYPE_PATTERN, "Embedding type contains unsupported characters");

const embeddingDocumentIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(EMBEDDING_SAFE_IDENTIFIER_PATTERN, "Embedding ID contains unsupported characters");

export const insertEmbeddingSchema = z
  .object({
    type: embeddingTypeSchema,
    content: z
      .string()
      .min(1)
      .refine((content) => utf8Length(content) <= EMBEDDING_CONTENT_MAX_BYTES, {
        message: "Embedding content exceeds 256 KiB",
      }),
    id: embeddingDocumentIdSchema.optional(),
    metadata: embeddingMetadataSchema.optional(),
    title: z.string().max(200).optional(),
  })
  .strict();

export const queryEmbeddingsSchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    type: embeddingTypeSchema.optional(),
  })
  .strict();

export const deleteEmbeddingSchema = z
  .object({
    ids: z
      .array(embeddingDocumentIdSchema)
      .min(1)
      .max(100)
      .superRefine((ids, ctx) => {
        if (new Set(ids).size !== ids.length) {
          ctx.addIssue({ code: "custom", message: "Embedding IDs must be unique" });
        }
      }),
  })
  .strict();

export type InsertEmbeddingInput = z.infer<typeof insertEmbeddingSchema>;
export type QueryEmbeddingsInput = z.infer<typeof queryEmbeddingsSchema>;
export type DeleteEmbeddingInput = z.infer<typeof deleteEmbeddingSchema>;
