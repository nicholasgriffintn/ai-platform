import { setTimeout as sleep } from "node:timers/promises";

import { readAccount } from "../account.js";
import { openInBrowser } from "../browser.js";
import type { CommandContext } from "../context.js";
import { saveCredential } from "../credentials.js";
import { requestDeviceCode, waitForDeviceApproval } from "../device-login.js";

export interface LoginOptions {
  clientName: string;
  openBrowser: boolean;
}

export async function login(context: CommandContext, options: LoginOptions): Promise<void> {
  const code = await requestDeviceCode(context.fetch, context.apiBaseUrl, options.clientName);
  const minutes = Math.round(code.expires_in / 60);

  context.info("");
  context.info(`  Your code   ${code.user_code}`);
  context.info(`  Approve at  ${code.verification_uri_complete}`);
  context.info("");

  if (options.openBrowser && (await openInBrowser(code.verification_uri_complete))) {
    context.info("Opened the approval page in your browser.");
  } else {
    context.info(`Open ${code.verification_uri} on any signed-in device and enter the code.`);
  }

  context.info(
    `Waiting for approval as "${options.clientName}". The code expires in ${minutes} minutes.`,
  );

  const apiKey = await waitForDeviceApproval({
    fetch: context.fetch,
    apiBaseUrl: context.apiBaseUrl,
    deviceCode: code.device_code,
    intervalSeconds: code.interval,
    expiresInSeconds: code.expires_in,
    sleep: (milliseconds) => sleep(milliseconds),
    now: () => Date.now(),
  });

  await saveCredential(context.credentialsPath, context.apiBaseUrl, {
    apiKey,
    clientName: options.clientName,
    createdAt: new Date().toISOString(),
  });

  const account = await readAccount(context.fetch, context.apiBaseUrl, apiKey).catch(() => null);

  context.info("");
  context.info(account ? `Signed in as ${account.email}.` : "Signed in.");
  context.info(`Key saved to ${context.credentialsPath}. Print it with: polychat token`);
}
