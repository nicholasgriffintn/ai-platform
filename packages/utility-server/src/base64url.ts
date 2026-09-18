export function encodeBase64Url(buffer: Uint8Array): string {
  const binaryString = String.fromCharCode(...buffer);
  const base64 = btoa(binaryString);

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
