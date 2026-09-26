import {
  AliasList,
  DeploymentList,
  SpendSummaryPanel,
  StatTile,
  TrainingRunList,
} from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { useModelsOverview } from "@ngriffin_uk/polychat-library-react";
import { ACTIVE_TRAINING_RUN_STATUSES } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

export function OverviewPlace() {
  const { workspaceId, projectId, open, goTo } = useModelsScope();
  const overview = useModelsOverview(workspaceId, projectId);

  if (overview.isLoading) {
    return <CardSkeleton />;
  }

  if (!overview.data) {
    return (
      <p className="text-sm text-failure">
        {getErrorMessage(overview.error, "Could not load models")}
      </p>
    );
  }

  const data = overview.data;
  const running = data.deployments.filter((deployment) => deployment.status === "running").length;
  const training = data.runs.filter((run) =>
    ACTIVE_TRAINING_RUN_STATUSES.includes(run.status),
  ).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Aliases"
          value={String(data.aliases.length)}
          detail="stable names apps call"
        />
        <StatTile
          label="Deployments"
          value={String(data.deployments.length)}
          detail={`${running} running`}
        />
        <StatTile label="Training" value={String(training)} detail="runs in flight" />
        <StatTile
          label="Waiting on review"
          value={String(data.pendingDecisions)}
          detail={
            data.connectedProviders.length === 0
              ? "no providers connected"
              : `${data.connectedProviders.length} providers connected`
          }
        />
      </div>

      {data.connectedProviders.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-attention/40 bg-attention/5 px-4 py-3 text-sm">
          <span>
            Connect a provider account before you train or deploy. Nothing runs on our tab.
          </span>
          <Button size="sm" variant="primary" onClick={() => goTo("governance")}>
            Connect a provider
          </Button>
        </div>
      )}

      <ModelsSection
        title="Aliases"
        description="What chat, teammates and apps actually call. Promote behind an alias; never repoint a client."
        actions={
          <Button size="sm" variant="ghost" onClick={() => goTo("deployments")}>
            All serving
          </Button>
        }
      >
        <AliasList aliases={data.aliases} onOpen={(alias) => open("aliases", alias.id)} />
      </ModelsSection>

      <ModelsSection title="Deployments">
        <DeploymentList
          deployments={data.deployments}
          onOpen={(deployment) => open("deployments", deployment.id)}
        />
      </ModelsSection>

      <ModelsSection
        title="Recent training"
        actions={
          <Button size="sm" variant="ghost" onClick={() => goTo("training")}>
            All runs
          </Button>
        }
      >
        <TrainingRunList runs={data.runs} onOpen={(run) => open("runs", run.id)} />
      </ModelsSection>

      <ModelsSection title="Spend this month">
        <SpendSummaryPanel spend={data.spend} />
      </ModelsSection>
    </div>
  );
}
