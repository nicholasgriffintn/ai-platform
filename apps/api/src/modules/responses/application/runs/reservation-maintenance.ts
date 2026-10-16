import { finishUsageReservation } from "@ngriffin_uk/polychat-ai-billing";

import { createRepositories } from "~/infrastructure/database/repositories";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import { UsageReservationRepository } from "~/modules/usage/infrastructure/UsageReservationRepository";
import type { IEnv } from "~/types";

export async function releaseExpiredChatRunReservations(
  env: IEnv,
  now = new Date(),
): Promise<number> {
  const repositories = createRepositories(env);
  const runtime = createUsageRuntime({ env, repositories });
  const expired = await repositories
    .get(UsageReservationRepository)
    .listExpiredHeldReservations("chat_run", now.toISOString(), 100);
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
