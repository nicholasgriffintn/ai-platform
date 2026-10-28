import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { savedEditionIds, selectExpiredEditions } from "~/modules/discover/domain/retention";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { listRecentDiscoverEditions } from "./editions";
import { listDiscoverFeedback } from "./feedback";

const EDITION_SCAN_LIMIT = 100;

export async function tidyDiscover(
  context: ServiceContext,
  today: string,
): Promise<{ editions: number }> {
  const user = context.requireUser();
  const [editions, feedback] = await Promise.all([
    listRecentDiscoverEditions(context, user.id, EDITION_SCAN_LIMIT),
    listDiscoverFeedback(context, user.id),
  ]);
  const expired = selectExpiredEditions(
    editions.map((edition) => ({ id: edition.id, date: edition.content.date })),
    savedEditionIds(feedback),
    today,
  );

  if (expired.length > 0) {
    await context.repositories.get(OutputRepository).deleteOutputs(expired);
  }

  return { editions: expired.length };
}
