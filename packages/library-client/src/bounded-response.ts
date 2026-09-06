export interface BoundedTextResponse {
  text: string;
  contentType: string;
  truncated: boolean;
  binary: boolean;
}

function isTextContentType(contentType: string): boolean {
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  return (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/ld+json" ||
    mediaType === "application/x-ndjson" ||
    mediaType.endsWith("+json") ||
    mediaType.endsWith("+xml")
  );
}

export function boundTextToBytes(text: string, maxBytes: number) {
  const encoded = new TextEncoder().encode(text);

  if (encoded.byteLength <= maxBytes) {
    return { text, truncated: false };
  }

  return {
    text: new TextDecoder().decode(encoded.slice(0, maxBytes)),
    truncated: true,
  };
}

export async function readBoundedTextResponse(
  response: Response,
  maxBytes: number,
): Promise<BoundedTextResponse> {
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";

  if (!isTextContentType(contentType)) {
    await response.body?.cancel().catch(() => undefined);

    return { text: "", contentType, truncated: false, binary: true };
  }

  if (!response.body) {
    return { text: "", contentType, truncated: false, binary: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  let truncated = Number(response.headers.get("content-length")) > maxBytes;

  while (bytesRead < maxBytes) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    const remaining = maxBytes - bytesRead;
    const accepted = value.byteLength > remaining ? value.slice(0, remaining) : value;

    chunks.push(decoder.decode(accepted, { stream: true }));
    bytesRead += accepted.byteLength;

    if (accepted.byteLength < value.byteLength) {
      truncated = true;
      break;
    }
  }

  if (bytesRead >= maxBytes && !truncated) {
    const next = await reader.read();

    truncated = !next.done;
  }

  if (truncated) {
    await reader.cancel().catch(() => undefined);
  }

  chunks.push(decoder.decode());

  return {
    text: chunks.join(""),
    contentType,
    truncated,
    binary: false,
  };
}
