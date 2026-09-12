import z from "zod/v4";

export const teammateComputerStatusSchema = z.enum([
  "stopped",
  "provisioning",
  "ready",
  "checkpointing",
  "takeover",
  "error",
  "destroyed",
]);

export const teammateComputerLeaseSchema = z.object({
  kind: z.enum(["agent", "user"]),
  ownerId: z.string().min(1),
  expiresAt: z.string(),
  fence: z.number().int().positive(),
});

export const teammateComputerSchema = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1),
  provider: z.string().min(1),
  checkpointReference: z.string().nullable(),
  status: teammateComputerStatusSchema,
  lease: teammateComputerLeaseSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const teammateComputerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("provision") }),
  z.object({ action: z.literal("observe") }),
  z.object({ action: z.literal("checkpoint") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("destroy") }),
]);

export const teammateComputerInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), url: z.url().max(2048) }),
  z.object({
    type: z.literal("click"),
    x: z.number().int().min(0).max(1439),
    y: z.number().int().min(0).max(899),
    button: z.enum(["left", "middle", "right"]).default("left"),
  }),
  z.object({ type: z.literal("type"), text: z.string().max(10_000) }),
  z.object({
    type: z.literal("key"),
    key: z.enum([
      "BackSpace",
      "Delete",
      "Down",
      "End",
      "Escape",
      "Home",
      "Left",
      "Page_Down",
      "Page_Up",
      "Return",
      "Right",
      "Tab",
      "Up",
      "ctrl+a",
      "ctrl+c",
      "ctrl+f",
      "ctrl+l",
      "ctrl+r",
      "ctrl+v",
      "ctrl+w",
    ]),
  }),
  z.object({
    type: z.literal("scroll"),
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number().int().min(1).max(20).default(3),
  }),
  z.object({ type: z.literal("wait"), durationMs: z.number().int().min(100).max(10_000) }),
]);

export const teammateComputerActionResponseSchema = z.object({
  computer: teammateComputerSchema,
  observation: z.record(z.string(), z.unknown()).optional(),
});

export const teachingRecordingIdSchema = z
  .string()
  .regex(
    /^teaching_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
    "Teaching recording id is invalid",
  );

export const teammateComputerTakeoverInputSchema = z.object({
  recordTeaching: z.boolean(),
});

export const teammateComputerTakeoverResponseSchema = z.object({
  computer: teammateComputerSchema,
  screenUrl: z.string().url(),
  expiresAt: z.string(),
  recordingId: teachingRecordingIdSchema.optional(),
});

export const teammateComputerTeachingRecordingSchema = z.object({
  id: teachingRecordingIdSchema,
  startedAt: z.string(),
  pointerActions: z.number().int().nonnegative(),
  keyActions: z.number().int().nonnegative(),
  totalActions: z.number().int().nonnegative(),
  actions: z.array(z.enum(["pointer", "keyboard"])).max(500),
});

export type TeammateComputer = z.infer<typeof teammateComputerSchema>;
export type TeammateComputerAction = z.infer<typeof teammateComputerActionSchema>;
export type TeammateComputerInput = z.infer<typeof teammateComputerInputSchema>;
export type TeammateComputerLease = z.infer<typeof teammateComputerLeaseSchema>;
export type TeammateComputerTeachingRecording = z.infer<
  typeof teammateComputerTeachingRecordingSchema
>;
