import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

export interface OutboundFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface WorkerLimits {
  cpuMs?: number;
  subRequests?: number;
}

export interface WorkerModuleContent {
  js?: string;
  cjs?: string;
  text?: string;
  json?: unknown;
  data?: ArrayBuffer;
}

export type WorkerModule = string | WorkerModuleContent;

export interface WorkerCodeSpec {
  mainModule: string;
  modules: Record<string, WorkerModule>;
  compatibilityDate: string;
  compatibilityFlags?: string[];
  limits?: WorkerLimits;
  env?: Record<string, unknown>;
  globalOutbound?: OutboundFetcher | null;
  tails?: Fetcher[];
}

export const DEFAULT_COMPATIBILITY_DATE = "2026-08-28";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);

    return `{${entries.join(",")}}`;
  }

  if (value instanceof ArrayBuffer) {
    return `"data:${value.byteLength}"`;
  }

  return JSON.stringify(value) ?? "null";
}

export async function workerCodeId(spec: WorkerCodeSpec): Promise<string> {
  return sha256Hex(
    stableJson({
      mainModule: spec.mainModule,
      modules: spec.modules,
      compatibilityDate: spec.compatibilityDate,
      compatibilityFlags: spec.compatibilityFlags ?? [],
      limits: spec.limits ?? null,
      env: spec.env ?? {},
      outboundBlocked: spec.globalOutbound === null,
    }),
  );
}
