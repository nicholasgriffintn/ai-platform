import type { CommandContext } from "../context.js";
import { forgetCredential } from "../credentials.js";

export async function logout(context: CommandContext): Promise<void> {
  const forgotten = await forgetCredential(context.credentialsPath, context.apiBaseUrl);

  if (!forgotten) {
    context.info(`No saved key for ${context.apiBaseUrl}.`);

    return;
  }

  context.info(`Removed the saved key for ${context.apiBaseUrl}.`);
  context.info("The key still works until you revoke it under Profile, API keys.");
}
