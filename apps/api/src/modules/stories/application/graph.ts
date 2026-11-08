import type { StoryVersionDraft } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonStringArray } from "@ngriffin_uk/polychat-utility-server/json";

import {
  entityId,
  entityKey,
  mergeEntityCandidates,
  pickLeadEntities,
} from "~/modules/stories/domain/entities";
import { verifyQuote, type QuoteBody } from "~/modules/stories/domain/quotes";
import type { ArticleFactRecord } from "~/modules/stories/infrastructure/ArticleFactRepository";
import {
  EntityRepository,
  type EntityUpsert,
} from "~/modules/stories/infrastructure/EntityRepository";
import { QuoteRepository } from "~/modules/stories/infrastructure/QuoteRepository";
import {
  StoryRepository,
  type StoryRecord,
} from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { linkStory } from "./link";

export interface StoryGraphOutcome {
  entities: number;
  quotes: number;
  dropped: number;
  edges: number;
}

async function recordEntities(
  env: IEnv,
  storyId: string,
  draft: Pick<StoryVersionDraft, "entities">,
  seenAt: string,
): Promise<EntityUpsert[]> {
  const merged = mergeEntityCandidates(draft.entities);
  const keyed = await Promise.all(
    merged.map(async (entity) => ({ ...entity, id: await entityId(entity.key) })),
  );
  const repository = new EntityRepository(env);
  const known = new Map(
    (await repository.listByIds(keyed.map((entity) => entity.id))).map((entity) => [
      entity.id,
      entity,
    ]),
  );
  const upserts = keyed.map((entity) => {
    const existing = known.get(entity.id);

    return {
      id: entity.id,
      key: entity.key,
      name: existing?.name ?? entity.name,
      kind: existing?.kind ?? entity.kind,
      aliases: [
        ...new Set([...(parseJsonStringArray(existing?.aliases) ?? []), ...entity.aliases]),
      ],
      role: entity.role,
    };
  });

  await repository.recordMentions(storyId, upserts, seenAt);

  return upserts;
}

async function recordQuotes(
  env: IEnv,
  storyId: string,
  draft: Pick<StoryVersionDraft, "quotes">,
  facts: readonly ArticleFactRecord[],
  bodies: ReadonlyMap<string, string>,
  entities: readonly EntityUpsert[],
  verifiedAt: string,
): Promise<{ kept: number; dropped: number }> {
  const held: QuoteBody[] = facts.flatMap((fact) => {
    const body = bodies.get(fact.id);

    return body ? [{ articleId: fact.id, outlet: fact.outlet_name, body }] : [];
  });
  const outlets = new Map(facts.map((fact) => [fact.id, fact.outlet_id]));
  const speakers = new Map(entities.map((entity) => [entity.key, entity.id]));
  const verified = draft.quotes.flatMap((quote) => verifyQuote(quote, held) ?? []);
  const quotes = await Promise.all(
    verified.map(async (quote) => ({
      id: `quote_${(await sha256Hex(`${storyId}:${quote.articleId}:${quote.text}`)).slice(0, 24)}`,
      storyId,
      articleId: quote.articleId,
      outletId: outlets.get(quote.articleId) ?? "unknown",
      speaker: quote.speaker,
      speakerEntityId: speakers.get(entityKey(quote.speaker)) ?? null,
      context: quote.context,
      text: quote.text,
      verifiedAt,
    })),
  );

  await new QuoteRepository(env).insertMany(quotes);

  return { kept: quotes.length, dropped: draft.quotes.length - quotes.length };
}

export async function recordStoryGraph(
  env: IEnv,
  story: StoryRecord,
  draft: Pick<StoryVersionDraft, "entities" | "quotes">,
  facts: readonly ArticleFactRecord[],
  bodies: ReadonlyMap<string, string>,
  now: Date,
): Promise<StoryGraphOutcome> {
  const seenAt = now.toISOString();
  const entities = await recordEntities(env, story.id, draft, seenAt);
  const quotes = await recordQuotes(env, story.id, draft, facts, bodies, entities, seenAt);
  const leadIds = await Promise.all(
    pickLeadEntities(mergeEntityCandidates(draft.entities)).map((entity) => entityId(entity.key)),
  );

  await new StoryRepository(env).setLeadEntities(story.id, leadIds);

  return {
    entities: entities.length,
    quotes: quotes.kept,
    dropped: quotes.dropped,
    edges: await linkStory(env, story, leadIds),
  };
}

export async function headlineEntityIds(names: Iterable<string>): Promise<string[]> {
  return Promise.all([...new Set([...names].map(entityKey))].map(entityId));
}
