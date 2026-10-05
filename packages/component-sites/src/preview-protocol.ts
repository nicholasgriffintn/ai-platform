import {
  siteProjectSchema,
  siteRecordOperationSchema,
  siteRecordOperationResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

export const SITE_PREVIEW_CHANNEL = "polychat-site-preview";

const envelope = { channel: z.literal(SITE_PREVIEW_CHANNEL), frameId: z.string().max(160) };
const session = { ...envelope, sessionId: z.guid() };

export const sitePreviewPayloadSchema = z
  .object({
    project: siteProjectSchema,
    pageId: z.string().nullable(),
    inspecting: z.boolean(),
    selectedKey: z.string().nullable(),
    siteRevision: z.number().int().positive().nullable(),
  })
  .strict();
export type SitePreviewRenderPayload = z.infer<typeof sitePreviewPayloadSchema>;

export const sitePreviewRenderMessageSchema = z
  .object({
    ...session,
    type: z.literal("render"),
    payload: sitePreviewPayloadSchema,
  })
  .strict();
export type SitePreviewRenderMessage = z.infer<typeof sitePreviewRenderMessageSchema>;

export const sitePreviewRuntimeMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("ready") }).strict(),
  z.object({ ...session, type: z.literal("navigate"), path: z.string().max(2048) }).strict(),
  z.object({ ...session, type: z.literal("select"), key: z.string().max(64).nullable() }).strict(),
  z
    .object({
      ...session,
      type: z.literal("records"),
      requestId: z.guid(),
      operation: siteRecordOperationSchema,
    })
    .strict(),
]);
export type SitePreviewRuntimeMessage = z.infer<typeof sitePreviewRuntimeMessageSchema>;

export const sitePreviewRecordResultSchema = z
  .object({
    ...session,
    type: z.literal("record-result"),
    requestId: z.guid(),
    result: z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), response: siteRecordOperationResponseSchema }).strict(),
      z.object({ ok: z.literal(false), error: z.string().max(500) }).strict(),
    ]),
  })
  .strict();
export type SitePreviewRecordResult = z.infer<typeof sitePreviewRecordResultSchema>;
