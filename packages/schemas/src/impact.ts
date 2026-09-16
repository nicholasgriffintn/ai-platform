import z from "zod/v4";

export const inferenceImpactMeasurementSchema = z.object({
  total: z.number().nonnegative(),
  unit: z.string().min(1),
});

export const inferenceImpactSchema = z
  .object({
    inferenceTime: inferenceImpactMeasurementSchema.optional(),
    energy: inferenceImpactMeasurementSchema.optional(),
    emissions: inferenceImpactMeasurementSchema.optional(),
    version: z.string().min(1).optional(),
  })
  .refine((impact) => Boolean(impact.inferenceTime ?? impact.energy ?? impact.emissions), {
    message: "Inference impact must include at least one measurement",
  });

export type InferenceImpactMeasurement = z.infer<typeof inferenceImpactMeasurementSchema>;
export type InferenceImpact = z.infer<typeof inferenceImpactSchema>;

export function readInferenceImpact(value: unknown): InferenceImpact | undefined {
  const parsed = inferenceImpactSchema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}
