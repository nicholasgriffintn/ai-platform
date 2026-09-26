import { concatBytes, decodeXmlEntities } from "@ngriffin_uk/polychat-utility-core";
import { AwsClient } from "aws4fetch";

import { misconfigured, modelProviderErrorFromStatus } from "../errors.js";
import { type Fetcher, JsonHttpClient, readUpstreamError } from "../http.js";
import type { ProviderCredentials } from "../types.js";

const SINGLE_PUT_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const MULTIPART_PART_BYTES = 32 * 1024 * 1024;

export interface AwsSettings {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  bucket: string | null;
  roleArn: string | null;
}

export function readAwsSettings(credentials: ProviderCredentials): AwsSettings {
  const accessKeyId = credentials.secrets.accessKeyId;
  const secretAccessKey = credentials.secrets.secretAccessKey;
  const region = credentials.config.region;

  if (!accessKeyId || !secretAccessKey || !region) {
    throw misconfigured("The AWS connection needs an access key, secret and region");
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: credentials.secrets.sessionToken || undefined,
    region,
    bucket: credentials.config.bucket || null,
    roleArn: credentials.config.roleArn || null,
  };
}

export class AwsRequester {
  private readonly clients = new Map<string, AwsClient>();

  constructor(
    readonly settings: AwsSettings,
    private readonly fetcher: Fetcher,
  ) {}

  private client(service: string): AwsClient {
    const existing = this.clients.get(service);

    if (existing) {
      return existing;
    }

    const client = new AwsClient({
      accessKeyId: this.settings.accessKeyId,
      secretAccessKey: this.settings.secretAccessKey,
      sessionToken: this.settings.sessionToken,
      region: this.settings.region,
      service,
    });

    this.clients.set(service, client);

    return client;
  }

  async signed(
    service: string,
    url: string,
    init: { method: string; headers?: Record<string, string>; body?: BodyInit },
  ): Promise<Response> {
    const request = await this.client(service).sign(url, init);

    return this.fetcher(request);
  }

  rest(service: string, host: string): JsonHttpClient {
    return new JsonHttpClient(
      `https://${host}`,
      () => ({}),
      (input, init) =>
        this.signed(service, input instanceof Request ? input.url : input.toString(), {
          method: init?.method ?? "GET",
          headers: init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {},
          body: init?.body ?? undefined,
        }),
    );
  }

  async target(
    service: string,
    host: string,
    target: string,
    payload: unknown,
    context: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.signed(service, `https://${host}/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": target,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw modelProviderErrorFromStatus(
        response.status,
        context,
        await readUpstreamError(response),
      );
    }

    const text = await response.text();

    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }

  async presignS3Get(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const url = new URL(s3ObjectUrl(bucket, this.settings.region, key));

    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

    const signed = await this.client("s3").sign(url.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });

    return signed.url;
  }

  async putS3Object(
    bucket: string,
    key: string,
    body: ReadableStream<Uint8Array> | string,
    size: number | null,
    contentType = "application/octet-stream",
  ): Promise<void> {
    const headers: Record<string, string> = { "content-type": contentType };

    if (size !== null) {
      headers["content-length"] = String(size);
    }

    const response = await this.signed("s3", s3ObjectUrl(bucket, this.settings.region, key), {
      method: "PUT",
      headers: { ...headers, "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
      body,
    });

    if (!response.ok) {
      throw modelProviderErrorFromStatus(
        response.status,
        `Writing s3://${bucket}/${key}`,
        await readUpstreamError(response),
      );
    }
  }

  async uploadS3Stream(
    bucket: string,
    key: string,
    stream: ReadableStream<Uint8Array>,
    size: number,
    contentType = "application/octet-stream",
  ): Promise<void> {
    if (size <= SINGLE_PUT_LIMIT_BYTES) {
      await this.putS3Object(bucket, key, stream, size, contentType);

      return;
    }

    const objectUrl = s3ObjectUrl(bucket, this.settings.region, key);
    const created = await this.signed("s3", `${objectUrl}?uploads`, {
      method: "POST",
      headers: { "content-type": contentType },
    });

    if (!created.ok) {
      throw modelProviderErrorFromStatus(
        created.status,
        `Starting a multipart upload to s3://${bucket}/${key}`,
        await readUpstreamError(created),
      );
    }

    const uploadId = /<UploadId>([\s\S]*?)<\/UploadId>/.exec(await created.text())?.[1];

    if (!uploadId) {
      throw misconfigured("S3 did not return an upload id");
    }

    const etags: string[] = [];
    const reader = stream.getReader();
    let pending: Uint8Array[] = [];
    let pendingBytes = 0;

    const flush = async () => {
      const part = concatBytes(pending);

      pending = [];
      pendingBytes = 0;

      const partNumber = etags.length + 1;
      const response = await this.signed(
        "s3",
        `${objectUrl}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`,
        {
          method: "PUT",
          body: new Uint8Array(part),
          headers: { "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
        },
      );

      if (!response.ok) {
        throw modelProviderErrorFromStatus(
          response.status,
          `Uploading part ${partNumber} of s3://${bucket}/${key}`,
          await readUpstreamError(response),
        );
      }

      etags.push(response.headers.get("etag") ?? "");
    };

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      pending.push(value);
      pendingBytes += value.byteLength;

      if (pendingBytes >= MULTIPART_PART_BYTES) {
        await flush();
      }
    }

    if (pendingBytes > 0) {
      await flush();
    }

    const completion = `<CompleteMultipartUpload>${etags
      .map(
        (etag, index) => `<Part><PartNumber>${index + 1}</PartNumber><ETag>${etag}</ETag></Part>`,
      )
      .join("")}</CompleteMultipartUpload>`;
    const completed = await this.signed(
      "s3",
      `${objectUrl}?uploadId=${encodeURIComponent(uploadId)}`,
      { method: "POST", body: completion, headers: { "content-type": "application/xml" } },
    );

    if (!completed.ok) {
      throw modelProviderErrorFromStatus(
        completed.status,
        `Completing the upload to s3://${bucket}/${key}`,
        await readUpstreamError(completed),
      );
    }
  }

  async headS3Bucket(bucket: string): Promise<boolean> {
    const response = await this.signed(
      "s3",
      `https://${bucket}.s3.${this.settings.region}.amazonaws.com/`,
      { method: "HEAD" },
    );

    return response.ok;
  }

  async openS3Object(bucket: string, key: string): Promise<Response> {
    const response = await this.signed("s3", s3ObjectUrl(bucket, this.settings.region, key), {
      method: "GET",
    });

    if (!response.ok) {
      throw modelProviderErrorFromStatus(
        response.status,
        `Reading s3://${bucket}/${key}`,
        await readUpstreamError(response),
      );
    }

    return response;
  }

  async listS3Prefix(
    bucket: string,
    prefix: string,
  ): Promise<Array<{ key: string; size: number; etag: string | null }>> {
    const objects: Array<{ key: string; size: number; etag: string | null }> = [];
    let continuation: string | null = null;

    for (let page = 0; page < 50; page += 1) {
      const url = new URL(`https://${bucket}.s3.${this.settings.region}.amazonaws.com/`);

      url.searchParams.set("list-type", "2");
      url.searchParams.set("prefix", prefix);

      if (continuation) {
        url.searchParams.set("continuation-token", continuation);
      }

      const response = await this.signed("s3", url.toString(), { method: "GET" });

      if (!response.ok) {
        throw modelProviderErrorFromStatus(
          response.status,
          `Listing s3://${bucket}/${prefix}`,
          await readUpstreamError(response),
        );
      }

      const xml = await response.text();

      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const block = match[1];
        const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
        const size = Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? "0");
        const etag = /<ETag>([\s\S]*?)<\/ETag>/.exec(block)?.[1] ?? null;

        if (key) {
          objects.push({
            key: decodeXmlEntities(key),
            size,
            etag: etag ? decodeXmlEntities(etag) : null,
          });
        }
      }

      continuation =
        /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null;

      if (!continuation) {
        break;
      }
    }

    return objects;
  }
}

export function s3ObjectUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function parseS3Uri(uri: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(.*)$/.exec(uri);

  if (!match) {
    throw misconfigured(`Not an S3 URI: ${uri}`);
  }

  return { bucket: match[1], key: match[2] };
}
