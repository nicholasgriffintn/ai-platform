/**
 * Encodes a Uint8Array to a Base64URL string.
 * Base64URL encoding replaces `+` with `-`, `/` with `_`, and removes padding `= T`.
 * @param buffer The Uint8Array to encode.
 * @returns The Base64URL encoded string.
 */
export function encodeBase64Url(buffer: Uint8Array): string {
  const binaryString = String.fromCharCode(...buffer);
  const base64 = btoa(binaryString);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a Base64URL string to a Uint8Array.
 * @param base64Url The Base64URL encoded string.
 * @returns The decoded Uint8Array.
 */
export function decodeBase64Url(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binaryString = atob(paddedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
