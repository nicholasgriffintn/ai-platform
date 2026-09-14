import type { MarkdownConversionOptions } from "@ngriffin_uk/polychat-schemas";

import { getMarkdownConverter, isToMarkdownResult } from "~/lib/cloudflare/markdownConversion";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/documentConverter" });

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
