import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
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
import {
  ArticleFactRepository,
  type ArticleFactRecord,
} from "~/modules/stories/infrastructure/ArticleFactRepository";
import { generateStoryObject } from "~/modules/stories/infrastructure/StoryModel";
import { StoryRepository } from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { recordStoryGraph } from "./graph";
import { storyRefreshState } from "./read-models";

const logger = getLogger({ prefix: "stories/refresh" });
const STORY_FACT_LIMIT = 60;
const STORY_BODY_CHARACTERS = 6000;

export type StoryRefreshOutcome = "written" | "unchanged" | "capped" | "missing";

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

export async function refreshStory(
  env: IEnv,
  storyId: string,
  now = new Date(),
): Promise<StoryRefreshOutcome> {
  const stories = new StoryRepository(env);
  const story = await stories.get(storyId);

  if (!story) {
    return "missing";
  }

  if (!needsStoryVersion(storyRefreshState(story), now)) {
    return "unchanged";
  }

  if ((await stories.countVersionsSince(startOfUtcDay(now))) >= DISCOVER_STORY_DAILY_VERSION_CAP) {
    logger.warn("The daily story version cap is spent", { story_id: storyId });

    return "capped";
  }

  const facts = pickVersionArticles(
    (await new ArticleFactRepository(env).listForStory(storyId, STORY_FACT_LIMIT)).map((fact) => ({
      ...fact,
      outletId: fact.outlet_id,
      publishedAt: fact.published_at,
    })),
  );
  const bodies = await readArticleBodies(env, facts);
  const draft = await generateStoryObject(env, {
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
    articleCount: story.article_count,
    outletCount: story.outlet_count,
  });

  if (!written) {
    return "unchanged";
  }

  const graph = await recordStoryGraph(env, story, draft.object, facts, bodies, now);

  logger.info("Wrote a story version", { story_id: storyId, version: story.version + 1, ...graph });

  return "written";
}
