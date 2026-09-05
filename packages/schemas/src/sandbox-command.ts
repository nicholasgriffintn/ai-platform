import z from "zod/v4";

const INLINE_SECRET_ASSIGNMENT =
  /\b(?:api[-_]?key|access[-_]?token|auth[-_]?token|password|passwd|private[-_]?key|secret)\s*=\s*(?!\$(?:\{|[A-Za-z_]))[^\s]+/i;
const INLINE_AUTHORIZATION_VALUE = /\b(?:Bearer|Token|Key)\s+[A-Za-z0-9._~+/=-]{8,}/i;
const RECOGNISABLE_TOKEN = /\b(?:sk|gh[pousr])_[A-Za-z0-9_-]{12,}\b/;

export const sandboxCommandSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !value.includes("\n") && !value.includes("\r"), {
    error: "Enter one command per item",
  })
  .refine(
    (value) =>
      !INLINE_SECRET_ASSIGNMENT.test(value) &&
      !INLINE_AUTHORIZATION_VALUE.test(value) &&
      !RECOGNISABLE_TOKEN.test(value),
    { error: "Reference a configured environment variable instead of storing a credential" },
  );

export type SandboxCommand = z.infer<typeof sandboxCommandSchema>;
