import z from "zod/v4";

export const READINESS_PROTOCOL_VERSION = 1 as const;

export const readinessStateSchema = z.enum(["ready", "setup_required", "unavailable", "unknown"]);

export const READINESS_REASON_CODES = [
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
  "runtime_not_configured",
  "runtime_unreachable",
  "runtime_model_missing",
  "runtime_model_loading",
  "machine_offline",
  "desktop_required",
  "agent_workspace_required",
  "agent_not_installed",
  "agent_signed_out",
] as const;

export const readinessReasonCodeSchema = z.enum(READINESS_REASON_CODES);

export const READINESS_ACTION_KINDS = [
  "retry",
  "sign_in",
  "upgrade",
  "configure_provider",
  "choose_model",
  "remove_attachment",
  "resolve_interaction",
  "start_new_conversation",
  "open_runtimes",
  "install_desktop",
  "open_on_machine",
  "choose_directory",
  "connect_repository",
  "copy_login_command",
] as const;

export const readinessActionSchema = z.object({
  kind: z.enum(READINESS_ACTION_KINDS),
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
export type ReadinessReasonCode = z.infer<typeof readinessReasonCodeSchema>;
export type ReadinessActionKind = z.infer<typeof readinessActionSchema>["kind"];

const readinessDecoderSchema = z
  .object({
    protocolVersion: z.literal(READINESS_PROTOCOL_VERSION),
    state: readinessStateSchema,
    reasonCode: z.string().min(1),
    reason: z.string().min(1),
    checkedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    action: z
      .object({
        kind: z.string().min(1),
        label: z.string().min(1),
        path: z.string().min(1).optional(),
      })
      .optional(),
  })
  .refine((readiness) => Date.parse(readiness.expiresAt) >= Date.parse(readiness.checkedAt), {
    message: "Readiness expiry cannot precede its check time",
    path: ["expiresAt"],
  });

const READINESS_ACTION_PATHS: Partial<Record<ReadinessActionKind, string>> = {
  upgrade: "/pricing",
  configure_provider: "/profile?tab=providers",
  choose_model: "/models",
  open_runtimes: "/profile?tab=providers",
  install_desktop: "/downloads",
  choose_directory: "/profile?tab=providers",
  connect_repository: "/work",
};

export function resolveReadinessActionPath(action: ReadinessAction): string | undefined {
  return action.path ?? READINESS_ACTION_PATHS[action.kind];
}

export function decodeReadiness(value: unknown): Readiness | undefined {
  const parsed = readinessDecoderSchema.safeParse(value);

  if (!parsed.success) {
    return undefined;
  }

  const { action: rawAction, reasonCode: rawReasonCode, ...readiness } = parsed.data;
  const reasonCode = readinessReasonCodeSchema.safeParse(rawReasonCode);
  const action = rawAction ? readinessActionSchema.safeParse(rawAction) : undefined;

  return {
    ...readiness,
    reasonCode: reasonCode.success ? reasonCode.data : "check_failed",
    ...(reasonCode.success && action?.success ? { action: action.data } : {}),
  };
}

export function isReadinessFresh(readiness: Readiness, now = new Date()): boolean {
  return Date.parse(readiness.expiresAt) > now.getTime();
}
