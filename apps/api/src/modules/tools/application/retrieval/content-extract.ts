import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { YouTubeVideo } from "@ngriffin_uk/polychat-schemas";
import { readYouTubeVideoId } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import { extractWithCloudflare } from "~/modules/tools/infrastructure/retrieval/content-extract/cloudflare";
import { extractWithGreenPt } from "~/modules/tools/infrastructure/retrieval/content-extract/greenpt";
import { saveExtractedContentToKnowledge } from "~/modules/tools/infrastructure/retrieval/content-extract/knowledge";
import { resolveContentExtractProvider } from "~/modules/tools/infrastructure/retrieval/content-extract/provider";
import { extractWithTavily } from "~/modules/tools/infrastructure/retrieval/content-extract/tavily";
import {
  readYouTubeVideo,
  type YouTubeVideoContent,
} from "~/modules/tools/infrastructure/retrieval/content-extract/youtube";
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

function describeVideo({ video, transcript }: YouTubeVideoContent): string {
  return [
    video.title ? `Title: ${video.title}` : null,
    video.author ? `Channel: ${video.author}` : null,
    `Video: ${video.url}`,
    "",
    "Transcript:",
    transcript,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function extractYouTubeVideos(urls: readonly string[]) {
  const videos = await Promise.all(
    urls.map(async (url) => ({
      url,
      content: await readYouTubeVideo(url).catch((error: unknown) => {
        logger.warn("YouTube video could not be read", { url, error });

        return null;
      }),
    })),
  );

  return {
    videos: videos.flatMap(({ content }) => (content ? [content.video] : [])),
    extracted: {
      results: videos.flatMap(({ url, content }) =>
        content?.transcript ? [{ url, raw_content: describeVideo(content) }] : [],
      ),
      failed_results: videos.flatMap(({ url, content }) =>
        content?.transcript ? [] : [{ url, error: "This video has no captions to read" }],
      ),
      response_time: 0,
    },
  };
}

async function extractPages(
  params: ContentExtractParams & { urls: string[] },
  req: IRequest,
): Promise<{
  provider: ContentExtractProvider;
  extracted: ExtractedContentPayload;
  videos: YouTubeVideo[];
}> {
  const provider = resolveContentExtractProvider(params, req);
  const youTube = await extractYouTubeVideos(params.urls.filter((url) => readYouTubeVideoId(url)));
  const pages = params.urls.filter((url) => !readYouTubeVideoId(url));

  if (pages.length === 0) {
    return { provider, extracted: youTube.extracted, videos: youTube.videos };
  }

  const extracted = await extractors[provider]({ ...params, urls: pages }, req);

  return {
    provider,
    videos: youTube.videos,
    extracted: {
      ...extracted,
      results: [...youTube.extracted.results, ...extracted.results],
      failed_results: [...youTube.extracted.failed_results, ...extracted.failed_results],
    },
  };
}

export const extractContent = async (
  params: ContentExtractParams,
  req: IRequest,
): Promise<ContentExtractResult> => {
  try {
    const safeParams = { ...params, urls: normalisePublicUrls(params.urls) };
    const { provider, extracted, videos } = await extractPages(safeParams, req);

    const result: ContentExtractResult = {
      status: "success",
      data: {
        extracted,
        ...(videos.length > 0 ? { videos } : {}),
      },
    };

    await saveExtractedContentToKnowledge({
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
