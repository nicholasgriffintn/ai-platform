export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  const binString = String.fromCharCode.apply(null, [...bytes]);
  return btoa(binString);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (char) => char.charCodeAt(0));
}
