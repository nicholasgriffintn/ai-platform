import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_LINK_METADATA_KEY,
  DISCOVER_LINK_RETENTION_DAYS,
  type DiscoverFollow,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import { createNotebook, updateNotebook } from "~/modules/notebooks/application/notebooks";
import { importNotebookResearch } from "~/modules/notebooks/application/research";
import { readNotebookSettings } from "~/modules/notebooks/domain/notebook";
import { NotebookRepository } from "~/modules/notebooks/infrastructure/NotebookRepository";

import { requireDiscoverEdition } from "./editions";
import { publishDiscoverChanged } from "./events";

const logger = getLogger({ prefix: "discover/follows" });
const LINKS_PER_FOLLOW = 3;
const NOTEBOOK_NAME_LIMIT = 40;

export async function listDiscoverFollows(
  context: ServiceContext,
  userId: number,
): Promise<DiscoverFollow[]> {
  const notebooks = await context.repositories
    .get(NotebookRepository)
    .listPersonalNotebooks(userId);

  return notebooks.flatMap((notebook) => {
    const topic = readNotebookSettings(notebook.settings).followTopic;

    return topic ? [{ notebookId: notebook.id, topic }] : [];
  });
}

export async function followDiscoverTopic(
  context: ServiceContext,
  topic: string,
): Promise<DiscoverFollow> {
  const user = context.requireUser();
  const key = discoverTopicKey(topic);
  const notebooks = await context.repositories
    .get(NotebookRepository)
    .listPersonalNotebooks(user.id);
  const following = notebooks.find((notebook) => {
    const followTopic = readNotebookSettings(notebook.settings).followTopic;

    return followTopic !== null && discoverTopicKey(followTopic) === key;
  });

  if (following) {
    return { notebookId: following.id, topic };
  }

  const name = topic.slice(0, NOTEBOOK_NAME_LIMIT).trim();
  const sameName = notebooks.find((notebook) => discoverTopicKey(notebook.title) === key);
  const notebookId =
    sameName?.id ?? (await createNotebook(context, { name, scope: { kind: "personal" } })).id;

  await updateNotebook(context, notebookId, { settings: { followTopic: topic } });
  await publishDiscoverChanged(context);

  return { notebookId, topic };
}

export async function unfollowDiscoverTopic(
  context: ServiceContext,
  notebookId: string,
): Promise<{ notebookId: string }> {
  await updateNotebook(context, notebookId, { settings: { followTopic: null } });
  await publishDiscoverChanged(context);

  return { notebookId };
}

export async function fileDiscoverLinks(context: ServiceContext, editionId: string) {
  const user = context.requireUser();
  const [edition, follows] = await Promise.all([
    requireDiscoverEdition(context, user.id, editionId),
    listDiscoverFollows(context, user.id),
  ]);
  let filed = 0;

  for (const follow of follows) {
    const key = discoverTopicKey(follow.topic);
    const results = edition.content.cards
      .flatMap((card) =>
        card.kind === "read" && discoverTopicKey(card.topic) === key
          ? [{ title: card.title.slice(0, 200), url: card.url }]
          : [],
      )
      .slice(0, LINKS_PER_FOLLOW);

    if (results.length === 0) {
      continue;
    }

    try {
      await importNotebookResearch(
        context,
        follow.notebookId,
        { results },
        {
          metadata: { [DISCOVER_LINK_METADATA_KEY]: true },
          keepDays: DISCOVER_LINK_RETENTION_DAYS,
        },
      );
      filed += results.length;
    } catch (error) {
      logger.warn("Discover links could not be filed", {
        notebookId: follow.notebookId,
        error_message: getErrorMessage(error),
      });
    }
  }

  return filed;
}
