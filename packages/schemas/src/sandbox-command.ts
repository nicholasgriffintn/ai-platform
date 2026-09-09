import z from "zod/v4";

const INLINE_SECRET_ASSIGNMENT =
  /(?:api[-_]?key|token|password|passwd|private[-_]?key|secret|credential)\s*=\s*(?!\$(?:\{|[A-Za-z_]))[^\s]+/i;
const INLINE_AUTHORIZATION_VALUE = /\b(?:Bearer|Token|Key)\s+[A-Za-z0-9._~+/=-]{8,}/i;
const RECOGNISABLE_TOKEN = /\b(?:sk|gh[pousr])_[A-Za-z0-9_-]{12,}\b/;

const SHELL_CHAINING_OPERATOR_PATTERN = /&&|\|\||;|\||(^|\s)&(\s|$)/;
const SHELL_EVALUATION_OPERATOR_PATTERN = /\$\(|`/;

export function hasBlockedShellChainingOperators(command: string): boolean {
  return SHELL_CHAINING_OPERATOR_PATTERN.test(command);
}

export function hasBlockedShellEvaluationOperators(command: string): boolean {
  return SHELL_EVALUATION_OPERATOR_PATTERN.test(command);
}

export function hasUnsafeShellOperators(command: string): boolean {
  return hasBlockedShellChainingOperators(command) || hasBlockedShellEvaluationOperators(command);
}

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
