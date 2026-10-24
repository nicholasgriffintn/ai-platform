import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export function publishDiscoverChanged(context: ServiceContext): Promise<void> {
  return publishResourceEvent(
    context,
    { kind: "personal", userId: context.requireUser().id },
    "discover.changed",
  );
}
