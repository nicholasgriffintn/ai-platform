import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "infra/write-breaker" });

const BREAKER_KEY = "infra:d1-write-breaker";
const BASELINE_KEY = "infra:d1-size-baseline";
const BREAKER_TTL_SECONDS = 60 * 60;
const BASELINE_TTL_SECONDS = 2 * 24 * 60 * 60;

export const D1_DAILY_GROWTH_LIMIT_BYTES = 50 * 1024 * 1024;

export type D1WriteBreakerState = "open" | "closed";

interface D1SizeBaseline {
  day: string;
  sizeBytes: number;
}

export async function isD1WriteBreakerOpen(env: IEnv): Promise<boolean> {
  try {
    return (await env.CACHE.get(BREAKER_KEY)) !== null;
  } catch (error) {
    logger.warn("Could not read the D1 write breaker", { error });

    return false;
  }
}

export async function d1WritesAllowed(env: IEnv): Promise<boolean> {
  return !(await isD1WriteBreakerOpen(env));
}

export async function checkD1WriteBreaker(
  env: IEnv,
  now: Date = new Date(),
): Promise<D1WriteBreakerState> {
  const day = now.toISOString().slice(0, 10);
  const { meta } = await env.DB.prepare("SELECT 1").run();
  const sizeBytes = meta.size_after;
  const baseline = await env.CACHE.get<D1SizeBaseline>(BASELINE_KEY, "json");

  if (baseline?.day !== day) {
    await env.CACHE.put(BASELINE_KEY, JSON.stringify({ day, sizeBytes }), {
      expirationTtl: BASELINE_TTL_SECONDS,
    });
    await env.CACHE.delete(BREAKER_KEY);

    return "closed";
  }

  const growthBytes = sizeBytes - baseline.sizeBytes;

  if (growthBytes >= D1_DAILY_GROWTH_LIMIT_BYTES) {
    await env.CACHE.put(BREAKER_KEY, String(growthBytes), { expirationTtl: BREAKER_TTL_SECONDS });
    logger.error("D1 write breaker is open, shedding non-essential writes", {
      growthBytes,
      limitBytes: D1_DAILY_GROWTH_LIMIT_BYTES,
    });

    return "open";
  }

  await env.CACHE.delete(BREAKER_KEY);

  return "closed";
}
