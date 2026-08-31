import {
  deleteEmbeddingSchema,
  insertEmbeddingSchema,
  queryEmbeddingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { z } from "zod/v4";

import { AssistantError, ErrorType } from "~/utils/errors";

const parseEmbeddingRequest = <Schema extends z.ZodType>(
  schema: Schema,
  request: unknown,
  errorMessage: string,
): z.infer<Schema> => {
  const parsed = schema.safeParse(request);

  if (!parsed.success) {
    throw new AssistantError(errorMessage, ErrorType.PARAMS_ERROR, 400);
  }

  return parsed.data;
};

export const parseInsertEmbeddingRequest = (request: unknown) =>
  parseEmbeddingRequest(insertEmbeddingSchema, request, "Invalid embedding request");

export const parseQueryEmbeddingsRequest = (request: unknown) =>
  parseEmbeddingRequest(queryEmbeddingsSchema, request, "Invalid embedding query");

export const parseDeleteEmbeddingRequest = (request: unknown) =>
  parseEmbeddingRequest(deleteEmbeddingSchema, request, "Invalid embedding deletion request");
