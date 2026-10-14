import type { Job } from "@ngriffin_uk/polychat-schemas";

import { publishUserEvent } from "~/modules/sync/application/conversation-events";
import type { SyncPublisher } from "~/modules/sync/application/publish";

export function publishJobChanged(publisher: SyncPublisher, userId: number, job: Job): void {
  publishUserEvent(publisher, userId, "job.changed", {
    job_id: job.id,
    kind: job.kind,
    status: job.status,
  });
}
