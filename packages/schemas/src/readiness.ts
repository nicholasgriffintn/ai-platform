import z from "zod/v4";

export const READINESS_PROTOCOL_VERSION = 1 as const;

export const readinessStateSchema = z.enum(["ready", "setup_required", "unavailable", "unknown"]);

export const readinessReasonCodeSchema = z.enum([
  "ready",
  "account_required",
  "plan_required",
  "credential_required",
  "permission_denied",
  "provider_unavailable",
  "model_unavailable",
  "attachment_incompatible",
  "active_run",
  "pending_interaction",
  "check_failed",
  "no_match",
]);

export const readinessActionSchema = z.object({
  kind: z.enum([
    "retry",
    "sign_in",
    "upgrade",
    "configure_provider",
    "choose_model",
    "remove_attachment",
    "resolve_interaction",
    "start_new_conversation",
  ]),
  label: z.string().min(1),
  path: z.string().min(1).optional(),
});

export const readinessSchema = z
  .object({
    protocolVersion: z.literal(READINESS_PROTOCOL_VERSION),
    state: readinessStateSchema,
    reasonCode: readinessReasonCodeSchema,
    reason: z.string().min(1),
    checkedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    action: readinessActionSchema.optional(),
  })
  .refine((readiness) => Date.parse(readiness.expiresAt) >= Date.parse(readiness.checkedAt), {
    message: "Readiness expiry cannot precede its check time",
    path: ["expiresAt"],
  });

export type Readiness = z.infer<typeof readinessSchema>;
export type ReadinessAction = z.infer<typeof readinessActionSchema>;
export type ReadinessState = z.infer<typeof readinessStateSchema>;

export function isReadinessFresh(readiness: Readiness, now = new Date()): boolean {
  return Date.parse(readiness.expiresAt) > now.getTime();
}
