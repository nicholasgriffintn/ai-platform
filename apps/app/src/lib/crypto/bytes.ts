export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function toBytes(source: BufferSource): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }

  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
