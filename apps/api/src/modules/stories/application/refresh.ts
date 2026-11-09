import { priceUsageDraft } from "@ngriffin_uk/polychat-ai-billing";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  BROWSER_RENDERING_RESOURCE,
  CLOUDFLARE_RATE_ENTRIES,
  CLOUDFLARE_VENDOR,
  DISCOVER_ARTICLE_METADATA_KEY,
  storyVersionDraftSchema,
} from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  resolveHttpUrl,
  truncateForModel,
} from "@ngriffin_uk/polychat-utility-core";

import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { buildStoryMaterial } from "~/modules/stories/domain/material";
import {
  DISCOVER_STORY_DAILY_VERSION_CAP,
  needsStoryVersion,
  pickVersionArticles,
  startOfUtcDay,
} from "~/modules/stories/domain/refresh";
import { fetchArticleBodies } from "~/modules/stories/infrastructure/ArticleBodyFetcher";
import {
  ArticleFactRepository,
  type ArticleFactRecord,
} from "~/modules/stories/infrastructure/ArticleFactRepository";
import { StoryRepository } from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { recordStoryGraph, type StoryGraphOutcome } from "./graph";
import { mergeRelatedStories } from "./merge";
import { storyRefreshState } from "./read-models";
import { generateStoryVersion } from "./story-model";

const logger = getLogger({ prefix: "stories/refresh" });
const STORY_FACT_LIMIT = 60;
const STORY_BODY_CHARACTERS = 6000;
const MS_PER_SECOND = 1000;

export type StoryRefreshOutcome =
  | {
      status: "written";
      graph: StoryGraphOutcome & {
        repaired: boolean;
        bodies: number;
        fetched: number;
        reserved: number;
        fetchFailed: number;
        merged: number;
      };
    }
  | { status: "unchanged" | "capped" | "missing" };

async function readArticleBodies(
  env: IEnv,
  facts: readonly ArticleFactRecord[],
): Promise<Map<string, string>> {
  const uris = [
    ...new Set(facts.flatMap((fact) => [fact.url, resolveHttpUrl(fact.url) ?? fact.url])),
  ];
  const pages = await new SourceRepository(env).listPersonalPagesByExternalUri(
    DISCOVER_ARTICLE_METADATA_KEY,
    uris,
  );
  const bodies = new Map<string, string>();

  for (const page of pages) {
    const key = page.external_uri ? comparableHttpUrl(page.external_uri) : null;

    if (key && !bodies.has(key)) {
      const text = (await readKnowledgeText({ env }, page)).trim();

      if (text) {
        bodies.set(key, text);
      }
    }
  }

  return new Map(
    facts.flatMap((fact) => {
      const body = bodies.get(comparableHttpUrl(fact.url) ?? fact.url);

      return body ? [[fact.id, body] as const] : [];
    }),
  );
}

function priceBrowserMs(browserMs: number): number {
  return browserMs > 0
    ? priceUsageDraft({
        source: "infrastructure",
        vendor: CLOUDFLARE_VENDOR,
        resource: BROWSER_RENDERING_RESOURCE,
        unit: "browser_seconds",
        quantity: browserMs / MS_PER_SECOND,
        rates: CLOUDFLARE_RATE_ENTRIES,
      }).costMicros
    : 0;
}

export async function refreshStory(
  env: IEnv,
  storyId: string,
  now = new Date(),
): Promise<StoryRefreshOutcome> {
  const stories = new StoryRepository(env);
  const story = await stories.get(storyId);

  if (!story) {
    return { status: "missing" };
  }

  if (!needsStoryVersion(storyRefreshState(story), now)) {
    return { status: "unchanged" };
  }

  if ((await stories.countVersionsSince(startOfUtcDay(now))) >= DISCOVER_STORY_DAILY_VERSION_CAP) {
    logger.warn("The daily story version cap is spent", { story_id: storyId });

    return { status: "capped" };
  }

  const facts = pickVersionArticles(
    (await new ArticleFactRepository(env).listForStory(storyId, STORY_FACT_LIMIT)).map((fact) => ({
      ...fact,
      outletId: fact.outlet_id,
      publishedAt: fact.published_at,
    })),
  );
  const held = await readArticleBodies(env, facts);
  const fetched = await fetchArticleBodies(
    env,
    facts.filter((fact) => !held.has(fact.id)).map((fact) => ({ id: fact.id, url: fact.url })),
  );
  const bodies = new Map([...held, ...fetched.bodies]);
  const draft = await generateStoryVersion(env, {
    schema: storyVersionDraftSchema,
    system: getPromptText("stories/version"),
    material: buildStoryMaterial(
      story.title,
      facts.map((fact) => ({
        source: fact.outlet_name,
        title: fact.headline,
        content: truncateForModel(
          bodies.get(fact.id) || fact.standfirst || fact.headline,
          STORY_BODY_CHARACTERS,
        ),
      })),
    ),
  });
  const written = await stories.writeVersion({
    storyId,
    version: story.version + 1,
    writtenAt: now.toISOString(),
    title: draft.object.title,
    overview: draft.object.overview,
    agreed: draft.object.agreed,
    disputed: draft.object.disputed,
    gaps: draft.object.gaps,
    outlets: draft.object.outlets,
    articleIds: facts.map((fact) => fact.id),
    model: draft.model,
    inputTokens: draft.inputTokens,
    outputTokens: draft.outputTokens,
    costMicros: draft.costMicros + priceBrowserMs(fetched.browserMs),
    bodyCount: bodies.size,
    articleCount: story.article_count,
    outletCount: story.outlet_count,
  });

  if (!written) {
    return { status: "unchanged" };
  }

  const graph = await recordStoryGraph(env, story, draft.object, facts, bodies, now);
  const merges = await mergeRelatedStories(env, storyId, now);

  logger.info("Wrote a story version", { story_id: storyId, version: story.version + 1, ...graph });

  return {
    status: "written",
    graph: {
      ...graph,
      repaired: draft.repaired,
      bodies: bodies.size,
      fetched: fetched.bodies.size,
      reserved: fetched.reserved,
      fetchFailed: fetched.failed,
      merged: merges.length,
    },
  };
}
