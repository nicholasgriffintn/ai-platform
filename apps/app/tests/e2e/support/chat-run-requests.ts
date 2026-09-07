import type { Page } from "@playwright/test";

export function isChatRunRecoveryRequest(url: string): boolean {
  return /\/chat\/runs\/[^/]+\/(?:events|snapshot)$/.test(new URL(url).pathname);
}

export function trackCompletionRequests(page: Page): string[] {
  const requests: string[] = [];

  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/chat/completions")
    ) {
      requests.push(request.url());
    }
  });

  return requests;
}
