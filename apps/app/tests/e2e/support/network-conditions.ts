import type { Page } from "@playwright/test";

export async function pauseNextNetworkRequest(page: Page, urlPattern: string) {
  const session = await page.context().newCDPSession(page);
  const request = new Promise<string>((resolve) => {
    session.once("Fetch.requestPaused", (event) => resolve(event.requestId));
  });
  let released = false;

  await session.send("Fetch.enable", {
    patterns: [{ urlPattern, requestStage: "Request" }],
  });

  return {
    wait: () => request,
    release: async () => {
      if (released) {
        return;
      }

      released = true;
      await session.send("Fetch.continueRequest", { requestId: await request });
      await session.send("Fetch.disable");
      await session.detach();
    },
  };
}
