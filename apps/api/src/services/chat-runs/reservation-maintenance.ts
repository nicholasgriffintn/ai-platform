import { finishUsageReservation } from "@ngriffin_uk/polychat-ai-billing";

import { RepositoryManager } from "~/repositories";
import { createUsageRuntime } from "~/services/usage/runtime";
import type { IEnv } from "~/types";

export async function releaseExpiredChatRunReservations(
  env: IEnv,
  now = new Date(),
): Promise<number> {
  const repositories = new RepositoryManager(env);
  const runtime = createUsageRuntime({ env, repositories });
  const expired = await repositories.usageReservations.listExpiredHeldReservations(
    "chat_run",
    now.toISOString(),
    100,
  );
  const finished = await Promise.all(
    expired.map((reservation) =>
      finishUsageReservation(runtime, {
        kind: "chat_run",
        refId: reservation.ref_id,
        reservationId: reservation.id,
        outcome: "released",
      }),
    ),
  );

  return finished.filter(Boolean).length;
}
