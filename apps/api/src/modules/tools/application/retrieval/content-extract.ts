import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { readYouTubeVideoId } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import { extractWithCloudflare } from "~/modules/tools/infrastructure/retrieval/content-extract/cloudflare";
import { extractWithGreenPt } from "~/modules/tools/infrastructure/retrieval/content-extract/greenpt";
import { resolveContentExtractProvider } from "~/modules/tools/infrastructure/retrieval/content-extract/provider";
import { extractWithTavily } from "~/modules/tools/infrastructure/retrieval/content-extract/tavily";
import { maybeVectorizeExtractedContent } from "~/modules/tools/infrastructure/retrieval/content-extract/vectorize";
import { readYouTubeTranscript } from "~/modules/tools/infrastructure/retrieval/content-extract/youtube";
import type { IRequest } from "~/types";

import type {
  ContentExtractParams,
  ContentExtractProvider,
  ContentExtractResult,
  ExtractedContentPayload,
} from "./content-extract-port";

export type { ContentExtractParams, ContentExtractResult };

const logger = getLogger({ prefix: "tools/content-extract" });

const extractors: Record<
  ContentExtractProvider,
  (params: ContentExtractParams, req: IRequest) => Promise<ExtractedContentPayload>
> = {
  cloudflare: extractWithCloudflare,
  greenpt: extractWithGreenPt,
  tavily: extractWithTavily,
};

function normalisePublicUrls(input: string | string[]): string[] {
  const values = Array.isArray(input) ? input : [input];

  if (values.length < 1 || values.length > 10) {
    throw new Error("Content extraction requires between 1 and 10 URLs");
  }

  return values.map((value) => parsePublicHttpUrl(value).toString());
}

async function extractYouTubeTranscripts(urls: readonly string[]) {
  const transcripts = await Promise.all(
    urls.map(async (url) => ({
      url,
      raw_content: await readYouTubeTranscript(url).catch((error: unknown) => {
        logger.warn("YouTube captions could not be read", { url, error });

        return null;
      }),
    })),
  );

  return transcripts.flatMap((transcript) =>
    transcript.raw_content ? [{ url: transcript.url, raw_content: transcript.raw_content }] : [],
  );
}

async function extractPages(
  params: ContentExtractParams & { urls: string[] },
  req: IRequest,
): Promise<{ provider: ContentExtractProvider; extracted: ExtractedContentPayload }> {
  const provider = resolveContentExtractProvider(params, req);
  const transcripts = await extractYouTubeTranscripts(
    params.urls.filter((url) => readYouTubeVideoId(url)),
  );
  const transcribed = new Set(transcripts.map((transcript) => transcript.url));
  const remaining = params.urls.filter((url) => !transcribed.has(url));

  if (remaining.length === 0) {
    return { provider, extracted: { results: transcripts, failed_results: [], response_time: 0 } };
  }

  const extracted = await extractors[provider]({ ...params, urls: remaining }, req);

  return {
    provider,
    extracted: { ...extracted, results: [...transcripts, ...extracted.results] },
  };
}

export const extractContent = async (
  params: ContentExtractParams,
  req: IRequest,
): Promise<ContentExtractResult> => {
  try {
    const safeParams = { ...params, urls: normalisePublicUrls(params.urls) };
    const { provider, extracted } = await extractPages(safeParams, req);

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
