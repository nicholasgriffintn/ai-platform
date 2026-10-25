import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_ARTICLE_METADATA_KEY,
  DISCOVER_LINK_METADATA_KEY,
  DISCOVER_RESEARCH_DAYS_KEPT,
} from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  openedLinkUrls,
  savedEditionIds,
  selectExpiredEditions,
  selectStaleLinks,
} from "~/modules/discover/domain/retention";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { deleteSource } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { listRecentDiscoverEditions } from "./editions";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { findDiscoverNotebook } from "./notebook";

const logger = getLogger({ prefix: "discover/retention" });
const EDITION_SCAN_LIMIT = 100;

export async function tidyDiscover(
  context: ServiceContext,
  today: string,
  now = Date.now(),
): Promise<{ editions: number; links: number }> {
  const user = context.requireUser();
  const [editions, feedback, follows] = await Promise.all([
    listRecentDiscoverEditions(context, user.id, EDITION_SCAN_LIMIT),
    listDiscoverFeedback(context, user.id),
    listDiscoverFollows(context, user.id),
  ]);
  const expired = selectExpiredEditions(
    editions.map((edition) => ({ id: edition.id, date: edition.content.date })),
    savedEditionIds(feedback),
    today,
  );

  if (expired.length > 0) {
    await context.repositories.get(OutputRepository).deleteOutputs(expired);
  }

  const opened = openedLinkUrls(feedback);
  const sources = context.repositories.get(SourceRepository);
  let links = 0;

  for (const follow of follows) {
    const filed = (await sources.listCollectionSources(follow.notebookId)).filter(
      (source) => parseJsonRecord(source.metadata)[DISCOVER_LINK_METADATA_KEY] === true,
    );
    const stale = selectStaleLinks(
      filed.map((source) => ({
        id: source.id,
        url: source.external_uri,
        createdAt: source.created_at,
      })),
      opened,
      now,
    );

    for (const sourceId of stale) {
      try {
        await deleteSource(context, user.id, sourceId);
        links += 1;
      } catch (error) {
        logger.warn("A stale Discover link could not be removed", {
          sourceId,
          error_message: getErrorMessage(error),
        });
      }
    }
  }

  const notebook = await findDiscoverNotebook(context, user.id);

  if (notebook) {
    const cutoff = now - DISCOVER_RESEARCH_DAYS_KEPT * DAY_MS;
    const articles = (await sources.listCollectionSources(notebook.id)).filter((source) => {
      const metadata = parseJsonRecord(source.metadata);
      const readAt = typeof metadata.readAt === "string" ? Date.parse(metadata.readAt) : Number.NaN;

      return (
        metadata[DISCOVER_ARTICLE_METADATA_KEY] !== undefined &&
        Number.isFinite(readAt) &&
        readAt < cutoff
      );
    });

    for (const article of articles) {
      try {
        await deleteSource(context, user.id, article.id);
        links += 1;
      } catch (error) {
        logger.warn("An old Discover article could not be removed", {
          sourceId: article.id,
          error_message: getErrorMessage(error),
        });
      }
    }
  }

  return { editions: expired.length, links };
}
