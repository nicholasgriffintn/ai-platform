import z from "zod/v4";

export const magicLinkVerifySchema = z.object({
	token: z.string(),
	nonce: z.string(),
});

export const magicLinkRequestSchema = z.object({
	email: z.email(),
});
