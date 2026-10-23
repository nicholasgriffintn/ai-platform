import z from "zod/v4";

export const AGE_GATE_MINIMUM_AGE = 18;

export const AGE_CHECK_RESULTS = ["adult", "under_age"] as const;

export type AgeCheckResult = (typeof AGE_CHECK_RESULTS)[number];

export const ageGateStatusSchema = z.enum(["not_required", "pending", ...AGE_CHECK_RESULTS]);

export type AgeGateStatus = z.infer<typeof ageGateStatusSchema>;

export const ageGateResponseSchema = z.object({
  status: ageGateStatusSchema,
});

export type AgeGateResponse = z.infer<typeof ageGateResponseSchema>;

export const ageConfirmationSchema = z.object({
  birth_date: z.iso.date(),
});

export type AgeConfirmation = z.infer<typeof ageConfirmationSchema>;
