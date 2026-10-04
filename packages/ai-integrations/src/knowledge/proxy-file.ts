import { knowledgeProxyFileSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  requirePresignedStorageUrl,
  readResponseTextWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";

export async function readKnowledgeProxyFile(value: unknown): Promise<string> {
  const file = knowledgeProxyFileSchema.safeParse(value);

  if (!file.success || Date.parse(file.data.expires_at) <= Date.now()) {
    throw new AssistantError(
      "Knowledge export is unavailable or unsupported",
      ErrorType.PARAMS_ERROR,
      422,
    );
  }

  const url = requirePresignedStorageUrl(file.data.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AssistantError(
        "Knowledge export download failed",
        ErrorType.EXTERNAL_API_ERROR,
        502,
      );
    }

    const contentType = response.headers.get("content-type");

    if (contentType && !contentType.toLowerCase().startsWith("text/")) {
      throw new AssistantError("Knowledge export is not text", ErrorType.PARAMS_ERROR, 422);
    }

    return await readResponseTextWithinLimit(response, 256 * 1024);
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError("Knowledge export download failed", ErrorType.EXTERNAL_API_ERROR, 502);
  } finally {
    clearTimeout(timeout);
  }
}
