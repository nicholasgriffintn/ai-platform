import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import type { IEnv } from "~/types";

const TOKEN_BYTES = 32;
const DEFAULT_API_BASE_URL = "https://api.polychat.app";

export const RECIPE_WEBHOOK_PATH = "/webhooks/recipes";

export function createWebhookToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));

  return `pcw_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function isWellFormedWebhookToken(token: string): boolean {
  return /^pcw_[0-9a-f]{64}$/.test(token);
}

export function hashWebhookToken(token: string): Promise<string> {
  return sha256Hex(`recipe-webhook:${token}`);
}

export function recipeWebhookUrl(env: Pick<IEnv, "API_BASE_URL">, token: string): string {
  return `${(env.API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "")}${RECIPE_WEBHOOK_PATH}/${token}`;
}
