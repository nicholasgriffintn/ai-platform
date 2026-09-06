import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const generatePatternInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .describe("The sound you want, in words. Say the instruments, feel and pace."),
  style: z
    .enum(["techno", "ambient", "house", "jazz", "drums", "experimental"])
    .optional()
    .describe("A style to work in, if the user named one."),
  tempo: z
    .number()
    .int()
    .min(40)
    .max(220)
    .optional()
    .describe("Beats per minute, if the user asked for a particular pace."),
  complexity: z
    .enum(["simple", "medium", "complex"])
    .optional()
    .describe("How dense the pattern should be. Default to simple when the user has not said."),
});

export const generate_pattern: FunctionToolDescriptor = {
  name: "generate_pattern",
  description:
    "Write a Strudel music pattern the user can play and edit, rather than a rendered audio file. Use it when someone asks for a beat, a loop or a musical idea they will want to change. For finished audio, use create_music instead.",
  type: "normal",
  permissions: ["reasoning", "write"],
  inputSchema: generatePatternInputSchema,
};
