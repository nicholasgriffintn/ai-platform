import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";

export function isPlatformAdmin(user: IUser | null | undefined): boolean {
  return authorise("platform.admin", { role: user?.role ?? "", strict: false }).allowed;
}

export async function requireManagedRun(
  context: ServiceContext,
  runId: string,
): Promise<BenchmarkRunRecord> {
  const user = context.requireUser();
  const run = await context.repositories.benchmarkRuns.get(runId);

  if (!run || run.scope === "human") {
    throw new AssistantError("Benchmark run not found", ErrorType.NOT_FOUND, 404);
  }

  const isOwner = run.scope !== "official" && ownsResource(user.id, run.owner_user_id);

  if (!isOwner && !isPlatformAdmin(user)) {
    throw new AssistantError("Benchmark run not found", ErrorType.NOT_FOUND, 404);
  }

  return run;
}
