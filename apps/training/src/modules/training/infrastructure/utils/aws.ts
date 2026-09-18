import { AwsClient } from "aws4fetch";

interface SignAwsJsonRequestOptions {
  url: string;
  target: string;
  payload: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export async function signAwsJsonRequest(
  options: SignAwsJsonRequestOptions,
): Promise<Record<string, string>> {
  const client = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    sessionToken: options.sessionToken,
    region: options.region,
    service: options.service,
  });
  const signed = await client.sign(options.url, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": options.target,
    },
    body: options.payload,
  });

  return Object.fromEntries(signed.headers.entries());
}
