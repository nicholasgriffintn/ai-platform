export class StorageService {
  constructor(private readonly bucket: R2Bucket) {}

  async uploadObject(
    key: string,
    data: string | ArrayBuffer | Uint8Array,
    options?: Record<string, string | number>,
  ): Promise<string> {
    await this.bucket.put(key, data, options);
    return key;
  }
}
