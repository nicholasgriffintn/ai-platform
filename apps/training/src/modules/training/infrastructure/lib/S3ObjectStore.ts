import { AwsClient } from "aws4fetch";

export interface AwsS3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

interface S3ObjectStoreOptions {
  bucket: string;
  region: string;
  credentials: AwsS3Credentials;
  fetcher?: typeof fetch;
}

interface PutObjectOptions {
  key: string;
  body: BodyInit;
  contentType?: string;
}

interface SignS3RequestOptions {
  method: string;
  url: URL;
  contentType?: string;
}

export class S3ObjectStore {
  private readonly fetcher: typeof fetch;
  private readonly client: AwsClient;

  constructor(private readonly options: S3ObjectStoreOptions) {
    this.fetcher = options.fetcher || fetch;
    this.client = new AwsClient({
      accessKeyId: options.credentials.accessKeyId,
      secretAccessKey: options.credentials.secretAccessKey,
      sessionToken: options.credentials.sessionToken,
      region: options.region,
      service: "s3",
    });
  }

  static joinKey(...parts: string[]): string {
    return parts
      .map((part) => part.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
  }

  static parseUri(uri: string): { bucket: string; key: string } {
    const match = uri.match(/^s3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(.+)$/);

    if (!match) {
      throw new Error(`Not an S3 object URI: ${uri}`);
    }

    return { bucket: match[1], key: match[2] };
  }

  async presignGet(key: string, expiresInSeconds: number): Promise<string> {
    const url = this.getObjectUrl(key);

    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

    const signed = await this.client.sign(url.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });

    return signed.url;
  }

  getPrefixUri(keyPrefix: string): string {
    return `s3://${this.options.bucket}/${trimKey(keyPrefix)}/`;
  }

  async hasObject(key: string): Promise<boolean> {
    const url = this.getObjectUrl(key);
    const response = await this.fetcher(url, {
      method: "HEAD",
      headers: await this.signRequest({
        method: "HEAD",
        url,
      }),
    });

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw new Error(
        `S3 HeadObject failed (${response.status}) for s3://${this.options.bucket}/${key}`,
      );
    }

    return true;
  }

  async putObject({ key, body, contentType }: PutObjectOptions): Promise<void> {
    const url = this.getObjectUrl(key);
    const response = await this.fetcher(url, {
      method: "PUT",
      headers: await this.signRequest({
        method: "PUT",
        url,
        contentType,
      }),
      body,
    });

    if (!response.ok) {
      throw new Error(
        `S3 PutObject failed (${response.status}) for s3://${this.options.bucket}/${key}`,
      );
    }
  }

  private getObjectUrl(key: string): URL {
    return new URL(
      `https://${this.options.bucket}.s3.${this.options.region}.amazonaws.com/${encodeKey(key)}`,
    );
  }

  private async signRequest({
    method,
    url,
    contentType,
  }: SignS3RequestOptions): Promise<Record<string, string>> {
    const signed = await this.client.sign(url.toString(), {
      method,
      ...(contentType ? { headers: { "content-type": contentType } } : {}),
    });

    return Object.fromEntries(signed.headers.entries());
  }
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function trimKey(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}
