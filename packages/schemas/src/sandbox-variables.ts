import z from "zod/v4";

export const sandboxEnvironmentVariableNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{0,63}$/, "Use an uppercase environment variable name");

export const sandboxEnvironmentVariableInputSchema = z.object({
  name: sandboxEnvironmentVariableNameSchema,
  value: z.string().max(16_384),
});

export const sandboxEnvironmentVariableSchema = z.object({
  name: sandboxEnvironmentVariableNameSchema,
  isSet: z.boolean(),
  updatedAt: z.string().min(1),
});

export const sandboxEnvironmentVariablesResponseSchema = z.object({
  variables: z.array(sandboxEnvironmentVariableSchema),
});

export type SandboxEnvironmentVariableInput = z.infer<typeof sandboxEnvironmentVariableInputSchema>;
export type SandboxEnvironmentVariable = z.infer<typeof sandboxEnvironmentVariableSchema>;
