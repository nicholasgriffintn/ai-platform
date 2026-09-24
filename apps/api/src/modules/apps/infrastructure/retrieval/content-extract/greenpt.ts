import { resolveGreenPtApiKey, greenPtJsonRequest } from "@ngriffin_uk/polychat-ai-providers";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { providerHost } from "~/infrastructure/providers/host";
import type {
  ContentExtractParams,
  ExtractedContentPayload,
} from "~/modules/apps/application/ports/content-extract";
import type { IRequest } from "~/types";

const greenPtScrapeResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z
    .object({
      markdown: z.string().optional(),
      html: z.string().optional(),
      rawHtml: z.string().optional(),
      links: z.array(z.string()).optional(),
    })
    .optional(),
  error: z.string().optional(),
});

type GreenPtScrapeResponse = z.infer<typeof greenPtScrapeResponseSchema>;

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
  const urls = Array.isArray(params.urls) ? params.urls : [params.urls];

  for (const url of urls) {
    try {
      const response = await greenPtJsonRequest({
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
      const parsed = greenPtScrapeResponseSchema.safeParse(response);

      if (!parsed.success) {
        throw new AssistantError(
          "GreenPT scrape returned an unexpected response",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      const data = parsed.data;

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
