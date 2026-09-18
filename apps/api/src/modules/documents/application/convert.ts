import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { MarkdownConversionOptions } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import {
  getMarkdownConverter,
  isToMarkdownResult,
} from "~/infrastructure/cloudflare/markdownConversion";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "services/documents/convert" });

export async function convertBlobToMarkdownViaCloudflare(
  env: IEnv,
  blob: Blob,
  documentName?: string,
  conversionOptions?: MarkdownConversionOptions,
): Promise<{ result?: string; error?: string }> {
  const markdownConverter = getMarkdownConverter(env.AI);

  if (!markdownConverter) {
    return {
      error: "Cloudflare AI binding not available",
    };
  }

  try {
    const name = documentName || "document";

    try {
      const files = [
        {
          name,
          blob,
        },
      ];
      const result = conversionOptions
        ? await markdownConverter.toMarkdown(files, { conversionOptions })
        : await markdownConverter.toMarkdown(files);

      if (!Array.isArray(result) || result.length === 0) {
        return {
          error: "Invalid response from Cloudflare toMarkdown API",
        };
      }

      const firstResult = result[0];

      if (!isToMarkdownResult(firstResult)) {
        return {
          error: "Invalid response from Cloudflare toMarkdown API",
        };
      }

      if (firstResult.format === "error") {
        return {
          error: firstResult.error,
        };
      }

      return { result: firstResult.data };
    } catch (aiError) {
      throw new AssistantError(
        `Cloudflare toMarkdown API error: ${getErrorMessage(aiError)}`,
        ErrorType.EXTERNAL_API_ERROR,
        500,
      );
    }
  } catch (error) {
    logger.error("Error converting document to markdown:", { error });

    return {
      error: error instanceof Error ? error.message : "Unknown error during conversion",
    };
  }
}
