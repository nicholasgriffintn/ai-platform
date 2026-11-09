import type { StoryWorld, StoryWorldItem } from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText, truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { toFtsPhrasesQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import {
  findPersonalKnowledgeMentions,
  type KnowledgeMention,
} from "~/modules/knowledge/application/query/find";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { EntityRepository } from "~/modules/stories/infrastructure/EntityRepository";

import { requireStory } from "./read-models";

const WORLD_ENTITY_LIMIT = 5;
const WORLD_CHAT_LIMIT = 4;
const WORLD_ITEM_LIMIT = 10;
const WORLD_SNIPPET_LENGTH = 160;
const WORLD_NAME_MAX_LENGTH = 40;
const WORLD_ENTITY_KINDS = new Set(["person", "organisation", "product"]);
const DISCOVER_METADATA_PREFIX = "discover";

function findMatchedName(names: readonly string[], text: string): string | null {
  const haystack = ` ${normaliseComparableText(text)} `;

  return names.find((name) => haystack.includes(` ${normaliseComparableText(name)} `)) ?? null;
}

function isDiscoverFiling(metadata: string | null): boolean {
  return Object.keys(parseJsonRecord(metadata)).some((key) =>
    key.startsWith(DISCOVER_METADATA_PREFIX),
  );
}

async function findChats(
  context: ServiceContext,
  userId: number,
  names: readonly string[],
): Promise<StoryWorldItem[]> {
  const conversations = context.repositories.get(ConversationRepository);
  const results = await Promise.all(
    names.map(async (name) =>
      (await conversations.searchAccessibleConversations(userId, name, WORLD_CHAT_LIMIT))
        .filter((row) => row.project_id === null && row.title)
        .map((row) => ({ row, name })),
    ),
  );

  return results.flat().map(({ row, name }) => {
    const group = row.group ? safeParseJson<{ id?: unknown; name?: unknown }>(row.group) : null;

    return {
      id: row.id,
      kind: "chat" as const,
      title: row.title ?? "",
      snippet: typeof group?.name === "string" ? `In ${group.name}` : "",
      matched: name,
      notebookId: typeof group?.id === "string" ? group.id : null,
      updatedAt: row.updated_at,
    };
  });
}

async function findKnowledge(
  context: ServiceContext,
  userId: number,
  names: readonly string[],
): Promise<StoryWorldItem[]> {
  const query = toFtsPhrasesQuery(names);

  if (!query) {
    return [];
  }

  const passages = await findPersonalKnowledgeMentions(context.repositories, userId, query);
  const sources = new Map(
    (
      await context.repositories
        .get(SourceRepository)
        .getSourcesByIds(
          passages
            .filter((passage) => passage.resourceType === "source")
            .map((passage) => passage.sourceId),
        )
    ).map((source) => [source.id, source]),
  );
  const items = new Map<string, StoryWorldItem>();

  for (const passage of passages) {
    const item = toKnowledgeItem(passage, names, sources);

    if (item && !items.has(item.id)) {
      items.set(item.id, item);
    }
  }

  return [...items.values()];
}

function toKnowledgeItem(
  passage: KnowledgeMention,
  names: readonly string[],
  sources: ReadonlyMap<string, { metadata: string | null }>,
): StoryWorldItem | null {
  if (passage.resourceType === "source") {
    const source = sources.get(passage.sourceId);

    if (!source || isDiscoverFiling(source.metadata)) {
      return null;
    }
  }

  const matched = findMatchedName(names, `${passage.title} ${passage.content}`);

  return matched
    ? {
        id: passage.sourceId,
        kind: passage.resourceType === "memory" ? "memory" : "notebook",
        title: passage.title,
        snippet: truncateSingleLine(passage.content, WORLD_SNIPPET_LENGTH),
        matched,
        notebookId: null,
        updatedAt: passage.updatedAt,
      }
    : null;
}

export async function readStoryWorld(
  context: ServiceContext,
  storyId: string,
): Promise<StoryWorld> {
  const user = context.requireUser();

  await requireStory(context.env, storyId);

  const names = (await new EntityRepository(context.env).listForStory(storyId))
    .filter(
      (entity) =>
        WORLD_ENTITY_KINDS.has(entity.kind) && entity.name.length <= WORLD_NAME_MAX_LENGTH,
    )
    .slice(0, WORLD_ENTITY_LIMIT)
    .map((entity) => entity.name);

  if (names.length === 0) {
    return { searched: [], items: [] };
  }

  const [chats, knowledge] = await Promise.all([
    findChats(context, user.id, names),
    findKnowledge(context, user.id, names),
  ]);
  const items = new Map<string, StoryWorldItem>();

  for (const item of [...chats, ...knowledge]) {
    if (!items.has(`${item.kind}:${item.id}`)) {
      items.set(`${item.kind}:${item.id}`, item);
    }
  }

  return {
    searched: names,
    items: [...items.values()]
      .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
      .slice(0, WORLD_ITEM_LIMIT),
  };
}
