export class ByteCursorOverflowError extends Error {
  constructor(offset: number, length: number, size: number) {
    super(`Read of ${length} bytes at ${offset} passes the end of a ${size}-byte buffer`);

    this.name = "ByteCursorOverflowError";
  }
}

export class ByteCursor {
  readonly bytes: Uint8Array;
  private readonly view: DataView;
  offset: number;

  constructor(bytes: Uint8Array, offset = 0) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = offset;
  }

  get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  private claim(length: number): number {
    if (length < 0 || this.offset + length > this.bytes.byteLength) {
      throw new ByteCursorOverflowError(this.offset, length, this.bytes.byteLength);
    }

    const start = this.offset;

    this.offset += length;

    return start;
  }

  u8(): number {
    return this.view.getUint8(this.claim(1));
  }

  u16(): number {
    return this.view.getUint16(this.claim(2), true);
  }

  u32(): number {
    return this.view.getUint32(this.claim(4), true);
  }

  i32(): number {
    return this.view.getInt32(this.claim(4), true);
  }

  u64(): number {
    const value = this.view.getBigUint64(this.claim(8), true);

    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ByteCursorOverflowError(
        this.offset - 8,
        Number.MAX_SAFE_INTEGER,
        this.bytes.byteLength,
      );
    }

    return Number(value);
  }

  bytesOf(length: number): Uint8Array {
    const start = this.claim(length);

    return this.bytes.subarray(start, start + length);
  }

  text(length: number): string {
    return new TextDecoder().decode(this.bytesOf(length));
  }

  line(): string {
    const end = this.bytes.indexOf(0x0a, this.offset);

    if (end === -1) {
      throw new ByteCursorOverflowError(this.offset, this.remaining + 1, this.bytes.byteLength);
    }

    const value = new TextDecoder().decode(this.bytes.subarray(this.offset, end));

    this.offset = end + 1;

    return value;
  }

  skip(length: number): void {
    this.claim(length);
  }
}

export function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

export async function inflateRaw(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const reader = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < limit) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  await reader.cancel();

  return concatBytes(chunks).subarray(0, Math.min(total, limit));
}
