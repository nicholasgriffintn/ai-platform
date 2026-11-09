import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  isCrawlReserved,
  isRobotsAllowed,
  parseRobotsTxt,
  type RobotsPolicy,
} from "@ngriffin_uk/polychat-utility-server/crawl-permissions";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import { renderPageMarkdown } from "~/modules/tools/infrastructure/browser-rendering";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "stories/bodies" });
const CRAWLER_AGENT = "PolychatBot";
const PERMISSION_TIMEOUT_MS = 4000;
const RENDER_TIMEOUT_MS = 15_000;
const MIN_BODY_CHARACTERS = 200;

export interface ArticleBodyRequest {
  id: string;
  url: string;
}

export interface FetchedArticleBodies {
  bodies: Map<string, string>;
  attempted: number;
  reserved: number;
  failed: number;
  browserMs: number;
}

async function readRobots(origin: string): Promise<RobotsPolicy | null> {
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": CRAWLER_AGENT },
      signal: AbortSignal.timeout(PERMISSION_TIMEOUT_MS),
    });

    return response.ok ? parseRobotsTxt(await response.text()) : { groups: [] };
  } catch {
    return null;
  }
}

async function isReservedPage(url: URL): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": CRAWLER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(PERMISSION_TIMEOUT_MS),
    });

    return isCrawlReserved(response.headers);
  } catch {
    return true;
  }
}

export async function fetchArticleBodies(
  env: IEnv,
  requests: readonly ArticleBodyRequest[],
): Promise<FetchedArticleBodies> {
  const outcome: FetchedArticleBodies = {
    bodies: new Map(),
    attempted: 0,
    reserved: 0,
    failed: 0,
    browserMs: 0,
  };

  if (!env.ACCOUNT_ID || !env.BROWSER_RENDERING_API_KEY || requests.length === 0) {
    return outcome;
  }

  const robots = new Map<string, Promise<RobotsPolicy | null>>();

  for (const request of requests) {
    let url: URL;

    try {
      url = parsePublicHttpUrl(request.url);
    } catch {
      continue;
    }

    if (!robots.has(url.origin)) {
      robots.set(url.origin, readRobots(url.origin));
    }

    const policy = await robots.get(url.origin);

    if (
      !policy ||
      !isRobotsAllowed(policy, CRAWLER_AGENT, `${url.pathname}${url.search}`) ||
      (await isReservedPage(url))
    ) {
      outcome.reserved += 1;
      continue;
    }

    outcome.attempted += 1;

    try {
      const page = await renderPageMarkdown({
        accountId: env.ACCOUNT_ID,
        apiKey: env.BROWSER_RENDERING_API_KEY,
        url: url.toString(),
        timeoutMs: RENDER_TIMEOUT_MS,
      });

      outcome.browserMs += page.browserMs;

      if (page.markdown.trim().length >= MIN_BODY_CHARACTERS) {
        outcome.bodies.set(request.id, page.markdown);
      }
    } catch (error) {
      outcome.failed += 1;
      logger.warn("Could not read an article body", { error_message: getErrorMessage(error) });
    }
  }

  return outcome;
}
