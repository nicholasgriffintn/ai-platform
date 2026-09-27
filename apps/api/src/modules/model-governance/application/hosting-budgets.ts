import type { HostManifest } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { conflict } from "~/modules/model-registry/application/access";

export async function requireHostingBudgetCompatibility(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
  host: HostManifest,
): Promise<void> {
  if (host.pauseSupported !== false) {
    return;
  }

  const budgets = await repositories.modelSpend.listBudgets(workspaceId);

  if (
    budgets.some(
      (budget) =>
        (budget.project_id === null || budget.project_id === projectId) &&
        (budget.hard_stop || budget.idle_pause_minutes !== null),
    )
  ) {
    throw conflict(
      `${host.name} cannot pause, so it cannot enforce this scope's budget hard stop or idle pause. Choose a host that supports pausing or revise the budget settings.`,
    );
  }
}
