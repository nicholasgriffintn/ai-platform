import {
  CardSkeleton,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { PageShell } from "../../Shell/PageShell.js";
import { useWorkData } from "../WorkDataContext.js";
import { type ModelPlace, MODEL_PLACES } from "./modelPaths.js";
import { ModelsScopeProvider, useModelsScope } from "./ModelsScope.js";
import { DatasetsPlace } from "./places/DatasetsPlace.js";
import { DeploymentsPlace } from "./places/DeploymentsPlace.js";
import { EvaluationsPlace } from "./places/EvaluationsPlace.js";
import { GovernancePlace } from "./places/GovernancePlace.js";
import { LibraryPlace } from "./places/LibraryPlace.js";
import { OverviewPlace } from "./places/OverviewPlace.js";
import { TrainingPlace } from "./places/TrainingPlace.js";

const PLACE_LABELS: Record<ModelPlace, string> = {
  overview: "Overview",
  library: "Models",
  datasets: "Datasets",
  training: "Training",
  deployments: "Deployments",
  evaluations: "Evaluations",
  governance: "Governance",
};

const PLACES: Record<ModelPlace, () => ReactNode> = {
  overview: () => <OverviewPlace />,
  library: () => <LibraryPlace />,
  datasets: () => <DatasetsPlace />,
  training: () => <TrainingPlace />,
  deployments: () => <DeploymentsPlace />,
  evaluations: () => <EvaluationsPlace />,
  governance: () => <GovernancePlace />,
};

function PlaceTabs({ place }: { place: ModelPlace }) {
  const { goTo } = useModelsScope();

  return (
    <Tabs
      value={place}
      onValueChange={(value) => {
        const next = MODEL_PLACES.find((item) => item === value);

        if (next) {
          goTo(next);
        }
      }}
      className="space-y-6"
    >
      <TabsList className="flex-wrap">
        {MODEL_PLACES.map((item) => (
          <TabsTrigger key={item} value={item}>
            {PLACE_LABELS[item]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={place}>{PLACES[place]()}</TabsContent>
    </Tabs>
  );
}

export function WorkspaceModels({
  workspaceId,
  projectId,
  place = "overview",
}: {
  workspaceId: string;
  projectId?: string;
  place?: ModelPlace;
}) {
  const { workspaceQuery, projectQuery } = useWorkData();
  const scopeName = projectId ? projectQuery.data?.name : workspaceQuery.data?.name;

  if (workspaceQuery.isLoading || (projectId && projectQuery.isLoading)) {
    return <CardSkeleton />;
  }

  if (workspaceQuery.error || (projectId && projectQuery.error)) {
    return (
      <EmptyState
        title="Models unavailable"
        message="This workspace or project could not be loaded."
        className="min-h-[240px]"
      />
    );
  }

  return (
    <ModelsScopeProvider workspaceId={workspaceId} projectId={projectId}>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header title="Models" />
        <div className="space-y-6">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Bring models and data into {scopeName ?? "this scope"}, train and evaluate them, and
            serve them behind stable aliases on the accounts you connect. Every step leaves evidence
            behind it.
          </p>
          <PlaceTabs place={place} />
        </div>
      </PageShell.Content>
    </ModelsScopeProvider>
  );
}
