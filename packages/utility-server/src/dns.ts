import z from "zod/v4";

const DNS_OVER_HTTPS_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const TXT_RECORD_TYPE = 16;
const NOERROR = 0;

const dnsJsonResponseSchema = z.object({
  Status: z.number(),
  Answer: z.array(z.object({ type: z.number(), data: z.string() })).optional(),
});

function joinTxtStrings(data: string): string {
  const quoted = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)];

  return quoted.length > 0
    ? quoted.map((match) => match[1].replace(/\\(.)/g, "$1")).join("")
    : data;
}

export async function resolveTxtOverHttps(
  name: string,
  endpoint: string = DNS_OVER_HTTPS_ENDPOINT,
): Promise<string[]> {
  const url = new URL(endpoint);

  url.searchParams.set("name", name);
  url.searchParams.set("type", "TXT");

  const response = await fetch(url, { headers: { accept: "application/dns-json" } });

  if (!response.ok) {
    throw new Error(`DNS lookup failed with status ${response.status}`);
  }

  const parsed = dnsJsonResponseSchema.parse(await response.json());

  if (parsed.Status !== NOERROR) {
    return [];
  }

  return (parsed.Answer ?? [])
    .filter((answer) => answer.type === TXT_RECORD_TYPE)
    .map((answer) => joinTxtStrings(answer.data));
}
