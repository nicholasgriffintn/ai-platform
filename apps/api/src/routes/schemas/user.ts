import * as z from "zod";

export const updateUserSettingsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const updateUserSettingsSchema = z.object({
  nickname: z.string().nullable().optional(),
  job_role: z.string().nullable().optional(),
  traits: z.string().nullable().optional(),
  preferences: z.string().nullable().optional(),
  tracking_enabled: z.boolean().optional(),
});
