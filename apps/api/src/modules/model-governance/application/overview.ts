import type { ModelsOverview } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listDecisions } from "~/modules/model-registry/application/decisions";
import { listAliases } from "~/modules/model-serving/application/aliases";
import { listDeployments } from "~/modules/model-serving/application/deployments";
import { listTrainingRuns } from "~/modules/model-training/application/runs";

import { getMyModelPermissions } from "./permissions";
import { getSpendSummary } from "./spend";

const RECENT_RUNS = 8;

export async function getModelsOverview(
  context: ServiceContext,
  workspaceId: string,
  projectId?: string,
): Promise<ModelsOverview> {
  const permissions = await getMyModelPermissions(context, workspaceId);
  const [aliases, deployments, runs, decisions, spend, connections] = await Promise.all([
    listAliases(context, workspaceId, projectId),
    listDeployments(context, workspaceId, projectId),
    listTrainingRuns(context, workspaceId, projectId),
    listDecisions(context, workspaceId, { state: "pending", projectId }),
    getSpendSummary(context, workspaceId),
    context.repositories.modelConnections.listConnections(workspaceId),
  ]);

  return {
    aliases: aliases.aliases,
    deployments: deployments.deployments,
    runs: runs.runs.slice(0, RECENT_RUNS),
    pendingDecisions: decisions.decisions.length,
    spend,
    connectedProviders: connections.map((connection) => connection.provider),
    permissions,
  };
}
