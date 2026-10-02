import z from "zod/v4";

const identifier = z.string().min(1).max(256);

export const browserProviderSchema = z.enum(["openai"]);
export const browserCredentialSourceSchema = z.enum(["user", "workspace"]);

export const browserCredentialOriginSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const origin = new URL(value);

    return origin.protocol === "https:" && !origin.username && !origin.password;
  });

export const browserApprovalSchema = z.object({
  requestId: identifier,
  turnId: identifier,
  request: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("browser_origin_access"),
      origin: z.url().max(2048),
      reason: z.string().nullable(),
    }),
    z.object({
      type: z.literal("browser_authentication"),
      credential_origin: z.string().nullable(),
      reason: z.string().nullable(),
      fields: z
        .array(
          z.object({
            id: identifier,
            label: z.string(),
            type: z.string(),
            required: z.boolean(),
          }),
        )
        .max(6),
      options: z.array(
        z.object({
          id: identifier,
          label: z.string(),
          field_ids: z.array(identifier).max(6),
        }),
      ),
    }),
  ]),
});

export const browserApprovalResponseSchema = z.union([
  z
    .object({
      type: z.literal("browser_origin_access"),
      decision: z.enum(["approve", "deny", "cancel"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("browser_authentication"),
      action: z.literal("cancel"),
    })
    .strict(),
  z
    .object({
      type: z.literal("browser_authentication"),
      action: z.literal("submit"),
      selected_option: identifier.optional(),
      fields: z
        .array(
          z
            .object({
              field_id: identifier,
              value: z.string().max(16_384),
            })
            .strict(),
        )
        .max(6),
    })
    .strict(),
]);

export const submitBrowserApprovalSchema = z
  .object({
    requestId: identifier,
    response: browserApprovalResponseSchema,
  })
  .strict();

export const browserScreenshotSchema = z
  .string()
  .max(8 * 1024 * 1024)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i);

export const browserActivitySchema = z.object({
  id: identifier,
  title: z.string().nullable(),
  status: z.enum(["in_progress", "completed", "failed", "incomplete"]),
  screenshot: browserScreenshotSchema.nullable(),
});

export const browserSessionSnapshotSchema = z.object({
  status: z.enum(["starting", "running", "requires_action", "completed", "failed", "cancelled"]),
  turnId: identifier.nullable(),
  approvals: z.array(browserApprovalSchema),
  activity: z.array(browserActivitySchema),
  outputText: z.string(),
  error: z.string().nullable(),
});

export const browserSessionSchema = browserSessionSnapshotSchema.extend({
  id: identifier,
  provider: browserProviderSchema,
  model: z.string(),
});

export const browserAvailabilitySchema = z.object({
  available: z.boolean(),
  provider: browserProviderSchema,
  credentialSource: browserCredentialSourceSchema.nullable(),
});

export const browserScopeQuerySchema = z.object({
  projectId: identifier.optional(),
  workspaceId: identifier.optional(),
});
export const browserSessionParamsSchema = z.object({ id: identifier });
export const browserToolInputSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("start"),
      task: z.string().trim().min(1).max(20_000),
      model: z.string().min(1).max(200).optional(),
      allowedDomains: z
        .array(z.string().regex(/^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i))
        .min(1)
        .max(100)
        .optional(),
    })
    .strict(),
  z.object({ operation: z.literal("inspect"), sessionId: identifier }).strict(),
  z.object({ operation: z.literal("stop"), sessionId: identifier }).strict(),
  z.object({ operation: z.literal("destroy"), sessionId: identifier }).strict(),
]);

export const browserSessionViewDataSchema = z.object({
  renderer: z.literal("browser_session"),
  sessionId: identifier,
  humanInTheLoop: z.object({ interactionId: z.string().min(1) }).optional(),
});

export type BrowserProvider = z.infer<typeof browserProviderSchema>;
export type BrowserCredentialSource = z.infer<typeof browserCredentialSourceSchema>;
export type BrowserApproval = z.infer<typeof browserApprovalSchema>;
export type BrowserApprovalResponse = z.infer<typeof browserApprovalResponseSchema>;
export type SubmitBrowserApproval = z.infer<typeof submitBrowserApprovalSchema>;
export type BrowserSessionSnapshot = z.infer<typeof browserSessionSnapshotSchema>;
export type BrowserSession = z.infer<typeof browserSessionSchema>;
export type BrowserAvailability = z.infer<typeof browserAvailabilitySchema>;
export type BrowserToolInput = z.infer<typeof browserToolInputSchema>;

export type BrowserSessionViewData = z.infer<typeof browserSessionViewDataSchema>;
