import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { AwsClient } from "aws4fetch";

import type { IEnv } from "~/types";

const ROOT = "model-platform";
const PART_BYTES = 8 * 1024 * 1024;

type ArtefactEnv = Pick<
  IEnv,
  | "PRIVATE_ASSETS_BUCKET"
  | "PRIVATE_ASSETS_BUCKET_NAME"
  | "ACCOUNT_ID"
  | "ASSETS_BUCKET_ACCESS_KEY_ID"
  | "ASSETS_BUCKET_SECRET_ACCESS_KEY"
>;

export const artefactKeys = {
  uploadFile: (workspaceId: string, uploadId: string, path: string) =>
    `${ROOT}/uploads/${workspaceId}/${uploadId}/${path}`,
  datasetSplit: (workspaceId: string, versionId: string, split: string) =>
    `${ROOT}/datasets/${workspaceId}/${versionId}/${split}.jsonl`,
  datasetStaging: (workspaceId: string, versionId: string, chunk: number) =>
    `${ROOT}/datasets/${workspaceId}/${versionId}/staging/${String(chunk).padStart(6, "0")}.jsonl`,
  datasetStagingPrefix: (workspaceId: string, versionId: string) =>
    `${ROOT}/datasets/${workspaceId}/${versionId}/staging/`,
  runReport: (workspaceId: string, runId: string) =>
    `${ROOT}/runs/${workspaceId}/${runId}/report.json`,
};

export class ArtefactStore {
  private readonly bucket: R2Bucket;

  constructor(private readonly env: ArtefactEnv) {
    if (!env.PRIVATE_ASSETS_BUCKET) {
      throw new AssistantError("Private storage is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    this.bucket = env.PRIVATE_ASSETS_BUCKET;
  }

  get(key: string, range?: { offset: number; length: number }): Promise<R2ObjectBody | null> {
    return this.bucket.get(key, range ? { range } : undefined);
  }

  head(key: string): Promise<R2Object | null> {
    return this.bucket.head(key);
  }

  async putJson(key: string, value: unknown): Promise<void> {
    await this.bucket.put(key, JSON.stringify(value), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  async putText(key: string, value: string, contentType: string): Promise<void> {
    await this.bucket.put(key, value, { httpMetadata: { contentType } });
  }

  async readJson(key: string): Promise<unknown> {
    const object = await this.bucket.get(key);

    return object ? object.json() : null;
  }

  async list(prefix: string): Promise<R2Object[]> {
    const objects: R2Object[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.bucket.list({ prefix, cursor });

      objects.push(...page.objects);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    return objects;
  }

  async deletePrefix(prefix: string): Promise<void> {
    const keys = (await this.list(prefix)).map((object) => object.key);

    for (let index = 0; index < keys.length; index += 1000) {
      await this.bucket.delete(keys.slice(index, index + 1000));
    }
  }

  createMultipartUpload(key: string, contentType: string): Promise<R2MultipartUpload> {
    return this.bucket.createMultipartUpload(key, { httpMetadata: { contentType } });
  }

  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return this.bucket.resumeMultipartUpload(key, uploadId);
  }

  writer(key: string, contentType = "application/jsonl"): ArtefactWriter {
    return new ArtefactWriter(this, key, contentType);
  }

  private signer(): AwsClient {
    if (!this.env.ASSETS_BUCKET_ACCESS_KEY_ID || !this.env.ASSETS_BUCKET_SECRET_ACCESS_KEY) {
      throw new AssistantError("R2 access keys are not configured", ErrorType.CONFIGURATION_ERROR);
    }

    return new AwsClient({
      accessKeyId: this.env.ASSETS_BUCKET_ACCESS_KEY_ID,
      secretAccessKey: this.env.ASSETS_BUCKET_SECRET_ACCESS_KEY,
      region: "auto",
      service: "s3",
    });
  }

  private objectUrl(key: string): URL {
    if (!this.env.PRIVATE_ASSETS_BUCKET_NAME || !this.env.ACCOUNT_ID) {
      throw new AssistantError(
        "Private bucket name is not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return new URL(
      `https://${this.env.ACCOUNT_ID}.r2.cloudflarestorage.com/${this.env.PRIVATE_ASSETS_BUCKET_NAME}/${key
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
    );
  }

  async presign(key: string, method: "GET" | "PUT", expiresInSeconds: number): Promise<string> {
    const url = this.objectUrl(key);

    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

    const signed = await this.signer().sign(url.toString(), { method, aws: { signQuery: true } });

    return signed.url;
  }
}

export class ArtefactWriter {
  private upload: R2MultipartUpload | null = null;
  private readonly parts: R2UploadedPart[] = [];
  private buffer: Uint8Array[] = [];
  private buffered = 0;
  private readonly encoder = new TextEncoder();
  bytes = 0;

  constructor(
    private readonly store: ArtefactStore,
    private readonly key: string,
    private readonly contentType: string,
  ) {}

  async writeLine(value: unknown): Promise<void> {
    const encoded = this.encoder.encode(`${JSON.stringify(value)}\n`);

    this.buffer.push(encoded);
    this.buffered += encoded.byteLength;
    this.bytes += encoded.byteLength;

    while (this.buffered >= PART_BYTES) {
      await this.uploadPart(this.take(PART_BYTES));
    }
  }

  private take(size: number): Uint8Array {
    const part = new Uint8Array(size);
    let offset = 0;

    while (offset < size) {
      const chunk = this.buffer[0];
      const needed = size - offset;

      if (chunk.byteLength <= needed) {
        part.set(chunk, offset);
        offset += chunk.byteLength;
        this.buffer.shift();
      } else {
        part.set(chunk.subarray(0, needed), offset);
        this.buffer[0] = chunk.subarray(needed);
        offset += needed;
      }
    }

    this.buffered -= size;

    return part;
  }

  private async uploadPart(part: Uint8Array): Promise<void> {
    this.upload ??= await this.store.createMultipartUpload(this.key, this.contentType);
    this.parts.push(await this.upload.uploadPart(this.parts.length + 1, part));
  }

  async close(): Promise<number> {
    if (this.upload) {
      if (this.buffered > 0) {
        await this.uploadPart(this.take(this.buffered));
      }

      await this.upload.complete(this.parts);
    } else {
      await this.store.putText(
        this.key,
        new TextDecoder().decode(this.take(this.buffered)),
        this.contentType,
      );
    }

    return this.bytes;
  }
}
