import { userSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { CliError } from "./errors.js";
import { requestJson, type Fetch } from "./http.js";

const meSchema = z.object({
  user: userSchema.pick({ email: true, name: true }).nullable(),
});

export type Account = { email: string; name: string | null };

export async function readAccount(
  fetchImpl: Fetch,
  apiBaseUrl: string,
  apiKey: string,
): Promise<Account | null> {
  const response = await requestJson(fetchImpl, `${apiBaseUrl}/auth/me`, {
    method: "GET",
    apiKey,
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  const parsed = meSchema.safeParse(response.body);

  if (!response.ok || !parsed.success) {
    throw new CliError(`Polychat could not confirm the account (HTTP ${response.status}).`);
  }

  return parsed.data.user;
}
