import { resolveGreenPtApiKey, greenPtJsonRequest } from "@ngriffin_uk/polychat-ai-providers";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { providerHost } from "~/infrastructure/providers/host";
import type {
  ContentExtractParams,
  ExtractedContentPayload,
} from "~/modules/apps/application/ports/content-extract";
import type { IRequest } from "~/types";

interface GreenPtScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

function toUrlList(urls: string | string[]): string[] {
  return Array.isArray(urls) ? urls : [urls];
}

export function mapGreenPtScrapeResult(data: GreenPtScrapeResponse): string {
  const content = data.data?.markdown ?? data.data?.html ?? data.data?.rawHtml;

  if (content) {
    return content;
  }

  if (data.data?.links?.length) {
    return data.data.links.join("\n");
  }

  return "No content returned by GreenPT";
}

export async function extractWithGreenPt(
  params: ContentExtractParams,
  req: IRequest,
): Promise<ExtractedContentPayload> {
  const apiKey = await resolveGreenPtApiKey(providerHost, {
    env: req.env,
    userId: req.user?.id,
  });
  const startedAt = Date.now();
  const results: ExtractedContentPayload["results"] = [];
  const failed_results: ExtractedContentPayload["failed_results"] = [];

  for (const url of toUrlList(params.urls)) {
    try {
      const data = await greenPtJsonRequest<GreenPtScrapeResponse>({
        apiKey,
        path: "/tools/crawl/scrape",
        label: "GreenPT scrape",
        payload: {
          url,
          formats: ["markdown"],
          onlyMainContent: params.extract_depth !== "advanced",
          removeBase64Images: !params.include_images,
          blockAds: true,
        },
      });

      if (data.success === false) {
        throw new Error(data.error || "GreenPT scrape failed");
      }

      results.push({ url, raw_content: mapGreenPtScrapeResult(data) });
    } catch (error) {
      failed_results.push({ url, error: getErrorMessage(error) });
    }
  }

  return {
    results,
    failed_results,
    response_time: (Date.now() - startedAt) / 1000,
  };
}
