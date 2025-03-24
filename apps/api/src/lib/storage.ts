import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";

export class StorageService {
  constructor(private readonly bucket: R2Bucket) {}

  async getObject(key: string): Promise<string | null> {
    const object = await this.bucket.get(key);
    if (!object) {
      return null;
    }
    const arrayBuffer = await object.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  }

  async uploadObject(
    key: string,
    data: string | ArrayBuffer | Uint8Array,
    options?: Record<string, string | number>,
  ): Promise<string> {
    await this.bucket.put(key, data, options);
    return key;
  }
}
