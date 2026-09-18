import { SandboxError } from "@ngriffin_uk/polychat-library-sandbox";
import { z } from "zod";

import type { EvaluateOptions } from "./types.js";

export const DEFAULT_TIMEOUT_MS = 5_000;
export const MAX_TIMEOUT_MS = 60_000;
export const MAX_SCRIPT_BYTES = 256 * 1024;

const hostPattern = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

function optionsSchema(defaultTimeoutMs: number, maxTimeoutMs: number) {
  return z.object({
    script: z.string().trim().min(1).max(MAX_SCRIPT_BYTES),
    module: z.string().max(MAX_SCRIPT_BYTES).optional(),
    env: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    timeoutMs: z.number().int().min(100).max(maxTimeoutMs).default(defaultTimeoutMs),
    limits: z
      .object({
        cpuMs: z.number().int().min(1).max(maxTimeoutMs).optional(),
        subRequests: z.number().int().min(0).max(1_000).optional(),
      })
      .optional(),
    compatibilityFlags: z.array(z.string().min(1)).max(32).optional(),
    network: z
      .union([z.literal("all"), z.literal("none"), z.array(z.string().regex(hostPattern)).max(64)])
      .default("none"),
    isolation: z.enum(["fresh", "cached"]).default("fresh"),
  });
}

export type ResolvedEvaluateOptions = z.infer<ReturnType<typeof optionsSchema>> &
  Pick<EvaluateOptions, "tools" | "signal">;

export function resolveEvaluateOptions(
  options: EvaluateOptions,
  bounds: { defaultTimeoutMs: number; maxTimeoutMs: number },
): ResolvedEvaluateOptions {
  const parsed = optionsSchema(bounds.defaultTimeoutMs, bounds.maxTimeoutMs).safeParse(options);

  if (!parsed.success) {
    throw new SandboxError("invalid_options", "Invalid evaluation options", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (options.tools && options.tools.definitions.length === 0) {
    throw new SandboxError("invalid_options", "Tools were attached without any definitions");
  }

  return { ...parsed.data, tools: options.tools, signal: options.signal };
}
