import { readAccount } from "../account.js";
import type { CommandContext } from "../context.js";
import { readCredential } from "../credentials.js";
import { CliError } from "../errors.js";

export async function status(context: CommandContext): Promise<void> {
  const credential = await readCredential(context.credentialsPath, context.apiBaseUrl);

  if (!credential) {
    throw new CliError(`Not signed in to ${context.apiBaseUrl}. Run: polychat login`);
  }

  const account = await readAccount(context.fetch, context.apiBaseUrl, credential.apiKey);

  if (!account) {
    throw new CliError(
      `The saved key for ${context.apiBaseUrl} was revoked or has expired. Run: polychat login`,
    );
  }

  context.out(`Signed in to ${context.apiBaseUrl} as ${account.email}`);
  context.out(`Key "${credential.clientName}", issued ${credential.createdAt}`);
}
