import { arrayBufferToBase64 } from "./audio";

export function baseMimeType(type: string): string {
  return type.split(";")[0]?.trim().toLowerCase() ?? "";
}

export async function blobToBase64DataUrl(blob: Blob, mimeType = baseMimeType(blob.type)) {
  return `data:${mimeType};base64,${arrayBufferToBase64(await blob.arrayBuffer())}`;
}

export async function encodeImageAsJpegDataUrl(
  image: Blob,
  maxDimension: number,
  quality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Canvas is not supported in this browser");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
