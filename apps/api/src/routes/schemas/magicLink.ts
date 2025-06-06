import z from "zod";
import "zod-openapi/extend";

export const magicLinkVerifySchema = z.object({
  token: z.string(),
  nonce: z.string(),
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
});
