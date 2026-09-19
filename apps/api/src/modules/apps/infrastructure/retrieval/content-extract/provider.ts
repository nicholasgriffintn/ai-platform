import type {
  ContentExtractParams,
  ContentExtractProvider,
} from "~/modules/apps/application/ports/content-extract";
import type { IRequest } from "~/types";

export function resolveContentExtractProvider(
  params: ContentExtractParams,
  req: IRequest,
): ContentExtractProvider {
  if (params.provider && params.provider !== "auto") {
    return params.provider;
  }

  if (req.env.TAVILY_API_KEY) {
    return "tavily";
  }

  if (req.env.BROWSER_RENDERING_API_KEY && req.env.ACCOUNT_ID) {
    return "cloudflare";
  }

  if (req.env.GREENPT_API_KEY) {
    return "greenpt";
  }

  return "tavily";
}
