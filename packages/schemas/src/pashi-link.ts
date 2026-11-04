import z from "zod/v4";

export const pashiLinkStatusSchema = z.object({
  linked: z.boolean(),
  pro: z.boolean(),
});

export type PashiLinkStatus = z.infer<typeof pashiLinkStatusSchema>;

export const pashiLinkRequestSchema = z.object({
  token: z
    .string()
    .regex(/^[A-Za-z0-9._~-]{32,256}$/)
    .describe("Per-user credential Pashi issued for calling its tools."),
});

export type PashiLinkRequest = z.infer<typeof pashiLinkRequestSchema>;

export const pashiLinkSaveResultSchema = pashiLinkStatusSchema.extend({
  replaced_token: z
    .string()
    .optional()
    .describe("The credential this link replaced, so Pashi can retire it."),
});

export type PashiLinkSaveResult = z.infer<typeof pashiLinkSaveResultSchema>;
