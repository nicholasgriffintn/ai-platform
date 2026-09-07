import z from "zod/v4";

import { computeSiteSchema } from "./compute-sites.js";

export const runProvenanceSchema = z.object({
  site: computeSiteSchema,
  machineId: z.string().min(1).optional(),
  vendor: z.string().min(1).optional(),
  model: z.string().min(1),
});

export type RunProvenance = z.infer<typeof runProvenanceSchema>;

export function createRunProvenance(input: {
  site: RunProvenance["site"];
  model: string;
  machineId?: string;
  vendor?: string;
}): RunProvenance {
  return runProvenanceSchema.parse({
    site: input.site,
    model: input.model,
    ...(input.machineId ? { machineId: input.machineId } : {}),
    ...(input.vendor ? { vendor: input.vendor } : {}),
  });
}
