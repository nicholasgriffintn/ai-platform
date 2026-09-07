import z from "zod/v4";

export const COMPUTE_SITES = ["hosted", "browser", "device", "machine"] as const;

export const computeSiteSchema = z.enum(COMPUTE_SITES);

export type ComputeSite = z.infer<typeof computeSiteSchema>;
