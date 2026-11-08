import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export async function callCloudflareBrowserRendering({
  accountId,
  apiKey,
  path,
  body,
  signal,
}: {
  accountId: string;
  apiKey: string;
  path: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<unknown> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json: unknown = await response.json();

  return isRecord(json) ? (json.result ?? json) : json;
}
