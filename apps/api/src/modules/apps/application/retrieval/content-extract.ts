import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { extractWithCloudflare } from "~/modules/apps/infrastructure/retrieval/content-extract/cloudflare";
import { extractWithGreenPt } from "~/modules/apps/infrastructure/retrieval/content-extract/greenpt";
import { resolveContentExtractProvider } from "~/modules/apps/infrastructure/retrieval/content-extract/provider";
import { extractWithTavily } from "~/modules/apps/infrastructure/retrieval/content-extract/tavily";
import { maybeVectorizeExtractedContent } from "~/modules/apps/infrastructure/retrieval/content-extract/vectorize";
import type { IRequest } from "~/types";

import type {
  ContentExtractParams,
  ContentExtractProvider,
  ContentExtractResult,
  ExtractedContentPayload,
} from "../ports/content-extract";

export type { ContentExtractParams, ContentExtractResult };

const extractors: Record<
  ContentExtractProvider,
  (params: ContentExtractParams, req: IRequest) => Promise<ExtractedContentPayload>
> = {
  cloudflare: extractWithCloudflare,
  greenpt: extractWithGreenPt,
  tavily: extractWithTavily,
};

export const extractContent = async (
  params: ContentExtractParams,
  req: IRequest,
): Promise<ContentExtractResult> => {
  try {
    const provider = resolveContentExtractProvider(params, req);
    const extracted = await extractors[provider](params, req);

    const result: ContentExtractResult = {
      status: "success",
      data: {
        extracted,
      },
    };

    await maybeVectorizeExtractedContent({
      params,
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
