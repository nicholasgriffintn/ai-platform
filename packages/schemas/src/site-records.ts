import z from "zod/v4";

import {
  createNativeRecordSchema,
  updateNativeRecordSchema,
  deleteNativeRecordSchema,
  nativeRecordViewSchema,
  nativeRecordTableResponseSchema,
  nativeRecordListResponseSchema,
  nativeRecordSchema,
} from "./native-records.js";

const bindingFields = {
  viewId: z.string().min(1).max(40),
  siteRevision: z.number().int().positive(),
};

export const siteRecordOperationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      ...bindingFields,
      operation: z.literal("query"),
      offset: z.number().int().min(0).max(100_000).default(0),
      limit: z.number().int().min(1).max(100).default(100),
    })
    .strict(),
  z
    .object({ ...bindingFields, operation: z.literal("create"), input: createNativeRecordSchema })
    .strict(),
  z
    .object({
      ...bindingFields,
      operation: z.literal("update"),
      recordId: z.string().min(1),
      input: updateNativeRecordSchema,
    })
    .strict(),
  z
    .object({
      ...bindingFields,
      operation: z.literal("delete"),
      recordId: z.string().min(1),
      input: deleteNativeRecordSchema,
    })
    .strict(),
]);
export type SiteRecordOperation = z.infer<typeof siteRecordOperationSchema>;

export const siteRecordOperationResponseSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("query"),
      view: nativeRecordViewSchema,
      table: nativeRecordTableResponseSchema,
      result: nativeRecordListResponseSchema,
    })
    .strict(),
  z
    .object({ operation: z.enum(["create", "update", "delete"]), record: nativeRecordSchema })
    .strict(),
]);
export type SiteRecordOperationResponse = z.infer<typeof siteRecordOperationResponseSchema>;
