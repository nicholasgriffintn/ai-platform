import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { DISCOVER_CAPABILITY_ID, DISCOVER_LIVE_KIND } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  discoverLiveContentSchema,
  emptyDiscoverLive,
  type DiscoverLiveContent,
} from "~/modules/discover/domain/live";
import { DiscoverSeenRepository } from "~/modules/discover/infrastructure/DiscoverSeenRepository";
import { readOutputContent } from "~/modules/outputs/application/content";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { publishDiscoverChanged } from "./events";

export function discoverLiveId(userId: number): string {
  return `discover_live_${userId}`;
}

export async function readDiscoverLive(context: ServiceContext): Promise<DiscoverLiveContent> {
  const user = context.requireUser();
  const record = await context.repositories
    .get(OutputRepository)
    .getPersonalOutputByGroup(user.id, "discover:live", DISCOVER_LIVE_KIND);

  if (!record) {
    return emptyDiscoverLive();
  }

  const content = readOutputContent(record, DISCOVER_LIVE_KIND, discoverLiveContentSchema);

  if (!content || !ownsResource(user.id, record.created_by_user_id) || record.project_id !== null) {
    throw new AssistantError(
      "Discover could not read its current feed",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const dismissed = await context.repositories.get(DiscoverSeenRepository).dismissed(
    user.id,
    content.items.map((item) => item.id),
  );

  return {
    ...content,
    items: content.items.map((item) =>
      dismissed.has(item.id) ? { ...item, dismissed: true } : item,
    ),
  };
}

export async function updateDiscoverLive(
  context: ServiceContext,
  change: (content: DiscoverLiveContent) => DiscoverLiveContent,
): Promise<DiscoverLiveContent> {
  const user = context.requireUser();
  const outputs = context.repositories.get(OutputRepository);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const record = await outputs.getPersonalOutputByGroup(
      user.id,
      "discover:live",
      DISCOVER_LIVE_KIND,
    );
    const previous = record
      ? readOutputContent(record, DISCOVER_LIVE_KIND, discoverLiveContentSchema)
      : emptyDiscoverLive();

    if (
      !previous ||
      (record && (!ownsResource(user.id, record.created_by_user_id) || record.project_id !== null))
    ) {
      throw new AssistantError(
        "Discover could not read its current feed",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const content = discoverLiveContentSchema.parse(change(previous));

    if (JSON.stringify(previous) === JSON.stringify(content)) {
      return content;
    }

    try {
      if (record) {
        await outputs.updateOutput(record.id, {
          content,
          expectedRevision: record.revision,
          updatedByUserId: user.id,
        });
      } else {
        await outputs.createOutput({
          id: discoverLiveId(user.id),
          createdByUserId: user.id,
          capabilityId: DISCOVER_CAPABILITY_ID,
          groupId: "discover:live",
          kind: DISCOVER_LIVE_KIND,
          title: "Discover now",
          sensitivity: "personal",
          content,
        });
      }

      await publishDiscoverChanged(context);

      return content;
    } catch (error) {
      const conflict = error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR;
      const createdElsewhere =
        !record &&
        (await outputs.getPersonalOutputByGroup(user.id, "discover:live", DISCOVER_LIVE_KIND));

      if (!conflict && !createdElsewhere) {
        throw error;
      }
    }
  }

  throw new AssistantError("Discover kept changing while saving", ErrorType.CONFLICT_ERROR, 409);
}
