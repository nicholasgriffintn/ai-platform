import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { bufferToBase64 } from "~/utils/base64";

const logger = getLogger({ prefix: "IMAGE_PROCESSOR" });

const SUPPORTED_FORMATS = ["png", "jpeg", "jpg", "gif", "webp"] as const;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB

function normalizeFormat(format: string | null | undefined): string | null {
  if (!format) return null;
  const lower = format.toLowerCase();
  if (lower === "jpg") return "jpeg";
  return lower;
}

export function isValidImageUrl(url: string): boolean {
  try {
    // Allow data URLs and http(s)
    if (url.startsWith("data:")) return true;
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getImageFormat(url: string): string {
  try {
    if (url.startsWith("data:")) {
      // Example: data:image/png;base64,AAAA
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i.exec(url);
      if (match && match[1]) {
        const mime = match[1].toLowerCase();
        if (mime.endsWith("/jpeg") || mime.endsWith("/jpg")) return "jpeg";
        if (mime.endsWith("/png")) return "png";
        if (mime.endsWith("/gif")) return "gif";
        if (mime.endsWith("/webp")) return "webp";
      }
      return "";
    }

    const parsed = new URL(url);
    const pathname = parsed.pathname || "";
    const ext = pathname.split(".").pop() || "";
    return normalizeFormat(ext) || "";
  } catch {
    return "";
  }
}

export function validateImageFormat(url: string): boolean {
  const fmt = normalizeFormat(getImageFormat(url));
  if (!fmt) return false;
  return SUPPORTED_FORMATS.includes(fmt as (typeof SUPPORTED_FORMATS)[number]);
}

export function validateImageSize(buffer: ArrayBuffer | Uint8Array): boolean {
  const size = buffer instanceof Uint8Array ? buffer.byteLength : buffer.byteLength;
  return size <= MAX_IMAGE_BYTES;
}

export async function fetchImageAsBase64(url: string, timeoutMs = 15000): Promise<string> {
  if (!isValidImageUrl(url)) {
    throw new AssistantError(
      "Invalid image URL provided",
      ErrorType.PARAMS_ERROR,
    );
  }

  // Data URL short-circuit
  if (url.startsWith("data:")) {
    const commaIdx = url.indexOf(",");
    if (commaIdx === -1) {
      throw new AssistantError(
        "Malformed data URL for image",
        ErrorType.PARAMS_ERROR,
      );
    }
    const base64 = url.slice(commaIdx + 1);
    try {
      // Validate by decoding and re-encoding length
      const binary = atob(base64);
      const buf = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
      if (!validateImageSize(buf)) {
        throw new AssistantError(
          "Image size exceeds 25MB limit",
          ErrorType.PARAMS_ERROR,
        );
      }
    } catch (err) {
      if (err instanceof AssistantError) throw err;
      throw new AssistantError(
        "Failed to parse data URL image",
        ErrorType.PARAMS_ERROR,
      );
    }
    return base64;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new AssistantError(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
        ErrorType.NETWORK_ERROR,
      );
    }

    const contentLengthStr = response.headers.get("content-length");
    if (contentLengthStr) {
      const contentLength = Number(contentLengthStr);
      if (!Number.isNaN(contentLength) && contentLength > MAX_IMAGE_BYTES) {
        throw new AssistantError("Image size exceeds 25MB limit", ErrorType.PARAMS_ERROR);
      }
    }

    const contentType = response.headers.get("content-type") || "";
    const inferredFromUrl = normalizeFormat(getImageFormat(url));
    const inferredFromHeader = contentType.startsWith("image/")
      ? normalizeFormat(contentType.split("/")[1])
      : null;

    const format = inferredFromHeader || inferredFromUrl;
    if (!format || !SUPPORTED_FORMATS.includes(format as any)) {
      throw new AssistantError(
        "Image format not supported by Amazon Nova (supported: JPEG, PNG, GIF, WEBP)",
        ErrorType.PARAMS_ERROR,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!validateImageSize(arrayBuffer)) {
      throw new AssistantError("Image size exceeds 25MB limit", ErrorType.PARAMS_ERROR);
    }

    const base64 = bufferToBase64(arrayBuffer);
    return base64;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new AssistantError("Image fetch timed out", ErrorType.NETWORK_ERROR);
    }
    if (error instanceof AssistantError) throw error;
    logger.error("Unexpected error fetching image", { error });
    throw new AssistantError("Failed to fetch image", ErrorType.NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
  }
}