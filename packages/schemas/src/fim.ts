import z from "zod/v4";

export const fillInMiddleRequestSchema = z.object({
  model: z.string().optional().describe("The model to use for FIM completion"),
  prompt: z.string().describe("The code prefix (before cursor)"),
  suffix: z.string().optional().describe("The code suffix (after cursor)"),
  max_tokens: z.number().optional().describe("Maximum tokens to generate"),
  min_tokens: z.number().optional().describe("Minimum tokens to generate"),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("Sampling temperature"),
  top_p: z.number().min(0).max(1).optional().describe("Nucleus sampling"),
  stream: z.boolean().optional().describe("Enable streaming response"),
  stop: z.array(z.string()).optional().describe("Stop sequences"),
});

export const fillInMiddleResponseSchema = z.object({
  id: z.string(),
  object: z.literal("text_completion"),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      text: z.string(),
      index: z.number(),
      finish_reason: z.string().nullable(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});
