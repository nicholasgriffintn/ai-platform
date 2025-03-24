import { Embedding } from "../../lib/embedding";
import type { IRequest } from "../../types";

export interface ContentExtractParams {
  urls: string | string[];
  extract_depth?: "basic" | "advanced";
  include_images?: boolean;
  should_vectorize?: boolean;
  namespace?: string;
}

interface TavilyExtractResult {
  results: Array<{
    url: string;
    raw_content: string;
    images?: string[];
  }>;
  failed_results: Array<{
    url: string;
    error: string;
  }>;
  response_time: number;
}

export interface ContentExtractResult {
  status: "success" | "error";
  error?: string;
  data?: {
    extracted: TavilyExtractResult;
    vectorized?: {
      success: boolean;
      error?: string;
    };
  };
}

async function generateShortId(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `tx_${hashArray
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export const extractContent = async (
  params: ContentExtractParams,
  req: IRequest,
): Promise<ContentExtractResult> => {
  if (!req.env.TAVILY_API_KEY) {
    return {
      status: "error",
      error: "Tavily API key not configured",
    };
  }

  try {
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        urls: params.urls,
        extract_depth: params.extract_depth || "basic",
        include_images: params.include_images || false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        status: "error",
        error: `Error extracting content: ${error}`,
      };
    }

    const data = (await response.json()) as TavilyExtractResult;
    const result: ContentExtractResult = {
      status: "success",
      data: {
        extracted: data,
      },
    };

    if (params.should_vectorize && data.results.length > 0) {
      try {
        const embedding = Embedding.getInstance(req.env);
        const vectors = await Promise.all(
          data.results.map(async (r) => {
            const id = await generateShortId(r.url);
            return embedding.generate("webpage", r.raw_content, id, {
              url: r.url,
              type: "webpage",
              source: "tavily_extract",
            });
          }),
        );

        const flatVectors = vectors.flat();
        if (flatVectors.length > 0) {
          const insertResult = await embedding.insert(flatVectors, {
            namespace: params.namespace || "webpages",
          });

          result.data!.vectorized = {
            success: insertResult.mutationId !== undefined,
            error: insertResult.mutationId
              ? undefined
              : "Mutation ID is undefined",
          };
        }
      } catch (error) {
        result.data!.vectorized = {
          success: false,
          error: `Error vectorizing content: ${error}`,
        };
      }
    }

    return result;
  } catch (error) {
    return {
      status: "error",
      error: `Error extracting content: ${error}`,
    };
  }
};
