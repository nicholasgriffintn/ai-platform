import z from "zod/v4";

import { browserApprovalResponseSchema, browserSessionSchema } from "./browser-sessions.js";
import { machineRecordSchema } from "./machines.js";
import { listQuerySchema, listSchema } from "./platform/list.js";
import { sandboxRunDetailSchema } from "./sandbox.js";
import { teammateComputerSchema } from "./teammate-computers.js";

export const ENVIRONMENT_KINDS = ["sandbox", "browser", "teammate_computer", "machine"] as const;

export const environmentKindSchema = z.enum(ENVIRONMENT_KINDS);

const environmentFieldsSchema = z.object({
  object: z.literal("environment"),
  id: z.string(),
});

export const environmentSchema = z.discriminatedUnion("kind", [
  environmentFieldsSchema.extend({ kind: z.literal("sandbox"), detail: sandboxRunDetailSchema }),
  environmentFieldsSchema.extend({ kind: z.literal("browser"), detail: browserSessionSchema }),
  environmentFieldsSchema.extend({
    kind: z.literal("teammate_computer"),
    detail: teammateComputerSchema,
  }),
  environmentFieldsSchema.extend({ kind: z.literal("machine"), detail: machineRecordSchema }),
]);

export const environmentListSchema = listSchema(environmentSchema);

export const environmentParamsSchema = z.object({ environment_id: z.string().trim().min(1) });

export const environmentQuerySchema = z.object({ kind: environmentKindSchema.optional() });

export const listEnvironmentsQuerySchema = listQuerySchema.extend({
  kind: environmentKindSchema.optional(),
});

export const environmentAvailabilityQuerySchema = z.object({
  project_id: z.string().trim().min(1).optional(),
  workspace_id: z.string().trim().min(1).optional(),
});

const reasonSchema = z.string().trim().min(1).max(500).optional();
const expectedUpdatedAtSchema = z.string().trim().min(1).optional();

export const environmentActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pause"),
    reason: reasonSchema,
    expected_updated_at: expectedUpdatedAtSchema,
  }),
  z.object({
    action: z.literal("resume"),
    reason: reasonSchema,
    expected_updated_at: expectedUpdatedAtSchema,
  }),
  z.object({
    action: z.literal("cancel"),
    reason: reasonSchema,
    expected_updated_at: expectedUpdatedAtSchema,
  }),
  z.object({
    action: z.literal("extend_inspection"),
    extension_seconds: z.number().int().min(1).max(300).optional(),
    expected_updated_at: expectedUpdatedAtSchema,
  }),
  z.object({ action: z.literal("stop") }),
  z.object({
    action: z.literal("approve"),
    request_id: z.string().trim().min(1),
    response: browserApprovalResponseSchema,
  }),
  z.object({ action: z.literal("provision") }),
  z.object({ action: z.literal("observe") }),
  z.object({ action: z.literal("checkpoint") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("destroy") }),
  z.object({ action: z.literal("takeover"), record_teaching: z.boolean().default(false) }),
  z.object({ action: z.literal("view") }),
  z.object({ action: z.literal("release"), fence: z.number().int().positive() }),
]);

export const environmentRunParamsSchema = environmentParamsSchema.extend({
  run_id: z.uuid(),
});

export const environmentPreviewParamsSchema = environmentParamsSchema.extend({
  preview_id: z.string().trim().min(1),
});

export type EnvironmentKind = z.infer<typeof environmentKindSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type EnvironmentOf<TKind extends EnvironmentKind> = Extract<Environment, { kind: TKind }>;
export type EnvironmentAction = z.infer<typeof environmentActionSchema>;
export type EnvironmentActionName = EnvironmentAction["action"];
