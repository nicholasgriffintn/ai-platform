import type { IEnv } from "~/types";

export function resolveSandboxApiBaseUrl(env: Pick<IEnv, "API_BASE_URL">): string {
  const apiBaseUrl = env.API_BASE_URL?.trim();

  return apiBaseUrl || "https://api.polychat.app";
}
