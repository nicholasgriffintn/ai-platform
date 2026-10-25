import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_WIND_DOWN_KIND,
  discoverWindDownContentSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RecentWindDown } from "~/modules/discover/domain/wind-down";
import { readOutputContent } from "~/modules/outputs/application/content";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

const RECENT_WIND_DOWN_LIMIT = 10;

export async function listRecentWindDowns(
  context: ServiceContext,
  userId: number,
  excludeId?: string,
): Promise<RecentWindDown[]> {
  const records = await context.repositories
    .get(OutputRepository)
    .listPersonalOutputs(userId, DISCOVER_CAPABILITY_ID, {
      kind: DISCOVER_WIND_DOWN_KIND,
      limit: RECENT_WIND_DOWN_LIMIT,
    });

  return records.flatMap((record) => {
    const content = readOutputContent(
      record,
      DISCOVER_WIND_DOWN_KIND,
      discoverWindDownContentSchema,
    );

    return content && record.id !== excludeId
      ? [
          {
            kind: content.kind,
            bed: content.bed,
            createdAt: record.created_at,
            summary: content.summary,
            topic: content.topic,
            part: content.part,
            parked: content.parked,
          },
        ]
      : [];
  });
}
