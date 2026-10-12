import type { CommandContext } from "../context.js";
import { readCredential } from "../credentials.js";
import { CliError } from "../errors.js";

export async function token(context: CommandContext): Promise<void> {
  const credential = await readCredential(context.credentialsPath, context.apiBaseUrl);

  if (!credential) {
    throw new CliError(`Not signed in to ${context.apiBaseUrl}. Run: polychat login`);
  }

  context.out(credential.apiKey);
}
