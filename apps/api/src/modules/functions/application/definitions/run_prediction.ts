import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const runPredictionInputSchema = z.object({
  model_id: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      "The Replicate model to run, by its catalogue id, for example replicate-google-nano-banana-pro. Ask for the catalogue rather than guessing.",
    ),
  input: z
    .record(z.string(), z.unknown())
    .describe(
      "The model's own inputs, as its schema names them. Most take a prompt; image models often take width and height.",
    ),
  project_id: z
    .string()
    .min(1)
    .optional()
    .describe("Project the result belongs to. Omit for a personal result."),
});

export const run_prediction: FunctionToolDescriptor = {
  name: "run_prediction",
  description:
    "Run a model from Replicate's catalogue and keep the result in Files. Use it when a specific Replicate model does the job better than the built-in image, video or music tools. It runs on the user's own Replicate key and refuses when they have not configured one.",
  type: "byok",
  permissions: ["network", "write"],
  inputSchema: runPredictionInputSchema,
};
