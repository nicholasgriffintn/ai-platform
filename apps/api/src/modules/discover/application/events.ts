import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export interface DiscoverEditionRevision {
  id: string;
  revision: number;
}

export function publishDiscoverChanged(
  context: ServiceContext,
  edition?: DiscoverEditionRevision,
): Promise<void> {
  return publishResourceEvent(
    context,
    { kind: "personal", userId: context.requireUser().id },
    "discover.changed",
    edition ? { editionId: edition.id, revision: edition.revision } : {},
  );
}
