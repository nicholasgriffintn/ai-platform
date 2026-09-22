import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { isPublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import { extractWithCloudflare } from "~/modules/apps/infrastructure/retrieval/content-extract/cloudflare";
import { resolveContentExtractProvider } from "~/modules/apps/infrastructure/retrieval/content-extract/provider";
import { extractWithTavily } from "~/modules/apps/infrastructure/retrieval/content-extract/tavily";
import { maybeVectorizeExtractedContent } from "~/modules/apps/infrastructure/retrieval/content-extract/vectorize";
import type { IRequest } from "~/types";

import type { ContentExtractParams, ContentExtractResult } from "../ports/content-extract";

export type { ContentExtractParams, ContentExtractResult };

function normalisePublicUrls(input: string | string[]): string[] {
  const values = Array.isArray(input) ? input : [input];

  if (values.length < 1 || values.length > 10) {
    throw new Error("Content extraction requires between 1 and 10 URLs");
  }

  return values.map((value) => {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error("Invalid content extraction URL");
    }

    if (!isPublicHttpUrl(url) || url.username || url.password) {
      throw new Error("Refusing to extract a non-public URL");
    }

    return url.toString();
  });
}

export const extractContent = async (
  params: ContentExtractParams,
  req: IRequest,
): Promise<ContentExtractResult> => {
  try {
    const safeParams = { ...params, urls: normalisePublicUrls(params.urls) };
    const provider = resolveContentExtractProvider(safeParams, req);
    const extracted =
      provider === "cloudflare"
        ? await extractWithCloudflare(safeParams, req)
        : await extractWithTavily(safeParams, req);

    const result: ContentExtractResult = {
      status: "success",
      data: {
        extracted,
      },
    };

    await maybeVectorizeExtractedContent({
      params: safeParams,
      req,
      provider,
      extracted,
      result,
    });

    return result;
  } catch (error) {
    const errorMessage = getErrorMessage(error, "Unknown error");

    if (errorMessage === "Tavily API key not configured") {
      return {
        status: "error",
        error: errorMessage,
      };
    }

    return {
      status: "error",
      error: `Error extracting content: ${errorMessage.replace(/^Error:\s*/, "Error: ")}`,
    };
  }
};
