import type { APIResponse } from "@playwright/test";

export async function requireSuccessfulResponse(
  response: Pick<APIResponse, "ok" | "status" | "text">,
  operation: string,
): Promise<void> {
  if (!response.ok()) {
    throw new Error(`${operation} failed (${response.status()}): ${await response.text()}`);
  }
}
