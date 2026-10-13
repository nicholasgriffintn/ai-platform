import z from "zod/v4";

const probabilitySchema = z.number().min(0).max(1);

export type OpenAIDecisionQuestion =
  | { type: "predicate"; name: string; instructions: string }
  | {
      type: "choice";
      name: string;
      instructions: string;
      choices: { value: string; description: string }[];
    }
  | {
      type: "score";
      name: string;
      instructions: string;
      levels: { label: string; description: string }[];
    };

export const openaiDecisionResponseSchema = z.object({
  model: z.string().min(1),
  answers: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("predicate"),
        name: z.string().nullable(),
        probability: probabilitySchema,
      }),
      z.object({
        type: z.literal("choice"),
        name: z.string().nullable(),
        choice: z.union([z.string(), z.boolean()]),
        confidence: probabilitySchema,
        probabilities: z.array(
          z.object({
            value: z.union([z.string(), z.boolean()]),
            probability: probabilitySchema,
          }),
        ),
      }),
      z.object({
        type: z.literal("score"),
        name: z.string().nullable(),
        score: z.number().min(0),
        confidence: probabilitySchema,
        probabilities: z.array(
          z.object({
            value: z.number().int().min(0),
            label: z.string(),
            probability: probabilitySchema,
          }),
        ),
      }),
      z.object({ type: z.literal("refusal"), name: z.string().nullable() }),
    ]),
  ),
  usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
  }),
});

export type OpenAIDecisionAnswer = z.infer<typeof openaiDecisionResponseSchema>["answers"][number];
