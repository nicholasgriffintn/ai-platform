import z from "zod/v4";

import { teammateComputerInputSchema } from "./teammate-computers.js";

export const computerUseProviderSchema = z.enum(["hosted", "openai"]);

const identifier = z.string().min(1).max(256);

export const computerTaskInputSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("start"),
      provider: z.literal("openai").default("openai"),
      task: z.string().trim().min(1).max(20_000),
      model: z.string().min(1).max(200).optional(),
      allowedDomains: z
        .array(z.string().regex(/^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i))
        .min(1)
        .max(100)
        .optional(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("inspect"),
      provider: z.literal("openai").default("openai"),
      sessionId: identifier,
    })
    .strict(),
  z
    .object({
      operation: z.literal("stop"),
      provider: z.literal("openai").default("openai"),
      sessionId: identifier,
    })
    .strict(),
  z
    .object({
      operation: z.literal("destroy"),
      provider: z.literal("openai").default("openai"),
      sessionId: identifier,
    })
    .strict(),
]);

export const computerControlInputSchema = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("observe"), provider: z.literal("hosted").default("hosted") })
    .strict(),
  z
    .object({ operation: z.literal("read"), provider: z.literal("hosted").default("hosted") })
    .strict(),
  z
    .object({
      operation: z.literal("check"),
      provider: z.literal("hosted").default("hosted"),
      condition: z.string().trim().min(1).max(2_000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("input"),
      provider: z.literal("hosted").default("hosted"),
      input: teammateComputerInputSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("wait"),
      provider: z.literal("hosted").default("hosted"),
      durationMs: z.number().int().min(100).max(10_000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("request_takeover"),
      provider: z.literal("hosted").default("hosted"),
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z.object({ operation: z.literal("start"), provider: z.literal("hosted") }).strict(),
  z.object({ operation: z.literal("inspect"), provider: z.literal("hosted") }).strict(),
]);

export const computerUseInputSchema = z.union([
  ...computerTaskInputSchema.options,
  ...computerControlInputSchema.options,
]);

export const computerUseAvailabilitySchema = z.object({
  available: z.boolean(),
  providers: z.array(
    z.object({
      provider: computerUseProviderSchema,
      mode: z.enum(["interactive", "managed"]),
      available: z.boolean(),
      credentialSource: z.enum(["platform", "user", "workspace"]).nullable(),
      operations: z.array(z.string()),
    }),
  ),
});

export const COMPUTER_USE_OPERATIONS = {
  hosted: ["start", "inspect", "observe", "read", "check", "input", "wait", "request_takeover"],
  openai: ["start", "inspect", "stop", "destroy"],
} as const;

export type ComputerUseInput = z.infer<typeof computerUseInputSchema>;
export type ComputerTaskInput = z.infer<typeof computerTaskInputSchema>;
export type ComputerControlInput = z.infer<typeof computerControlInputSchema>;
export type ComputerUseAvailability = z.infer<typeof computerUseAvailabilitySchema>;
