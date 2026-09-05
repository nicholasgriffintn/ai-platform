import { finishUsageReservation } from "~/lib/usage/reservations";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";

export async function releaseExpiredChatRunReservations(
  env: IEnv,
  now = new Date(),
): Promise<number> {
  const repositories = new RepositoryManager(env);
  const expired = await repositories.usageReservations.listExpiredHeldReservations(
    "chat_run",
    now.toISOString(),
    100,
  );
  const finished = await Promise.all(
    expired.map((reservation) =>
      finishUsageReservation({
        repositories,
        kind: "chat_run",
        refId: reservation.ref_id,
        outcome: "released",
      }),
    ),
  );

  return finished.filter(Boolean).length;
}
