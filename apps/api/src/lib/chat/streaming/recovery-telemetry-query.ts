import z from "zod/v4";

export const recoveryTelemetryQueryFields = {
  recovery_platform: z.enum(["web", "ios"]).optional(),
  recovery_attempt: z.coerce.number().int().min(1).max(100).optional(),
  recovery_elapsed_ms: z.coerce.number().int().min(0).max(86_400_000).optional(),
  recovery_known_assistant_count: z.coerce.number().int().min(0).max(10_000).optional(),
  recovery_final_attempt: z.enum(["true", "false"]).optional(),
};

export function validateRecoveryTelemetryQuery(
  query: Partial<Record<keyof typeof recoveryTelemetryQueryFields, unknown>>,
  context: z.core.$RefinementCtx,
): void {
  const providedCount = Object.values(query).filter((value) => value !== undefined).length;

  if (providedCount > 0 && providedCount !== Object.keys(recoveryTelemetryQueryFields).length) {
    context.addIssue({
      code: "custom",
      message: "Recovery telemetry fields must be provided together",
      input: query,
    });
  }
}
