import z from "zod/v4";

import { sandboxCommandSchema } from "./sandbox-command";
import { sandboxServiceManifestSchema } from "./sandbox-services";

export const SANDBOX_REPOSITORY_ENVIRONMENT_PATH = ".polychat/environment.json";

export const sandboxEnvironmentCommandSchema = sandboxCommandSchema;

export const sandboxRuntimeNameSchema = z.enum(["node", "python", "go", "rust", "java", "ruby"]);

export const sandboxPackageManagerNameSchema = z.enum([
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "pip",
  "poetry",
  "uv",
  "cargo",
  "bundler",
  "maven",
  "gradle",
  "swiftpm",
]);

const requirementVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^[vV]?\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9.-]+)?$/,
    "Use an exact version or version prefix",
  );

export const sandboxRuntimeRequirementSchema = z
  .object({
    name: sandboxRuntimeNameSchema,
    version: requirementVersionSchema.optional(),
  })
  .strict();

export const sandboxPackageManagerRequirementSchema = z
  .object({
    name: sandboxPackageManagerNameSchema,
    version: requirementVersionSchema.optional(),
  })
  .strict();

export const sandboxEnvironmentDefinitionSchema = z
  .object({
    version: z.literal(1).default(1),
    setupCommands: z.array(sandboxEnvironmentCommandSchema).min(1).max(20),
    resumeCommands: z.array(sandboxEnvironmentCommandSchema).max(10).default([]),
    runtimes: z.array(sandboxRuntimeRequirementSchema).max(6).default([]),
    packageManager: sandboxPackageManagerRequirementSchema.optional(),
    setupTimeoutSeconds: z.number().int().min(30).max(1800).default(600),
    services: sandboxServiceManifestSchema.optional(),
  })
  .strict();

export const sandboxEnvironmentSetupSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("polychat"),
      definition: sandboxEnvironmentDefinitionSchema,
    })
    .strict(),
  z.object({ source: z.literal("repository") }).strict(),
]);

export const sandboxEnvironmentPreparationModeSchema = z.enum(["setup", "resume"]);
export const sandboxEnvironmentPreparationStatusSchema = z.enum(["completed", "failed", "skipped"]);

export type SandboxEnvironmentDefinition = z.infer<typeof sandboxEnvironmentDefinitionSchema>;
export type SandboxEnvironmentSetup = z.infer<typeof sandboxEnvironmentSetupSchema>;
export type SandboxEnvironmentPreparationMode = z.infer<
  typeof sandboxEnvironmentPreparationModeSchema
>;
export type SandboxRuntimeRequirement = z.infer<typeof sandboxRuntimeRequirementSchema>;
export type SandboxPackageManagerRequirement = z.infer<
  typeof sandboxPackageManagerRequirementSchema
>;
