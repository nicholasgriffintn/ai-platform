import type { Page } from "@playwright/test";

export async function addVirtualAuthenticator(page: Page) {
  const session = await page.context().newCDPSession(page);

  await session.send("WebAuthn.enable");
  const { authenticatorId } = await session.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      ctap2Version: "ctap2_1",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return async () => {
    await session.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await session.send("WebAuthn.disable");
  };
}
