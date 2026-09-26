import {
  AliasList,
  DeploymentList,
  RouteHealthPanel,
  RouteList,
} from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import {
  useAliases,
  useDeployments,
  useModelPlatformMutations,
  useModelRouteHealth,
  useModelRoutes,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { CreateAliasDialog } from "../flows/CreateAliasDialog.js";
import { DeployDialog } from "../flows/DeployDialog.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

function RoutesSection() {
  const { workspaceId, projectId, can } = useModelsScope();
  const routes = useModelRoutes(workspaceId, projectId);
  const mutations = useModelPlatformMutations(workspaceId);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const selected =
    routes.data?.find((route) => route.id === selectedRouteId) ??
    routes.data?.find((route) => route.status === "active");
  const health = useModelRouteHealth(workspaceId, selected?.id);

  return (
    <>
      <ModelsSection
        title="Routes"
        description="Every provider, model and region pair this scope can serve from, including catalogue providers and your own deployments."
      >
        {routes.isLoading ? (
          <CardSkeleton />
        ) : (
          <RouteList
            routes={routes.data ?? []}
            canGovern={can("deploy")}
            selectedRouteId={selected?.id}
            onSelect={(route) => setSelectedRouteId(route.id)}
            onRetire={(route) =>
              void runWithToast("Route retired", () => mutations.retireRoute.mutateAsync(route.id))
            }
          />
        )}
      </ModelsSection>
      {selected && (
        <ModelsSection
          title="Health"
          description={`${selected.displayName} on ${selected.provider} · ${selected.region}`}
        >
          {health.data ? <RouteHealthPanel health={health.data} /> : <CardSkeleton />}
        </ModelsSection>
      )}
    </>
  );
}

export function DeploymentsPlace() {
  const { workspaceId, projectId, open, can } = useModelsScope();
  const deployments = useDeployments(workspaceId, projectId);
  const aliases = useAliases(workspaceId, projectId);
  const [dialog, setDialog] = useState<"deploy" | "alias" | null>(null);

  return (
    <div className="space-y-8">
      <ModelsSection
        title="Aliases"
        description="Stable names with eval gates, canaries and rollbacks."
        actions={
          can("promote") && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("alias")}>
              New alias
            </Button>
          )
        }
      >
        {aliases.isLoading ? (
          <CardSkeleton />
        ) : (
          <AliasList aliases={aliases.data ?? []} onOpen={(alias) => open("aliases", alias.id)} />
        )}
      </ModelsSection>

      <ModelsSection
        title="Deployments"
        description="Models you run on your own provider accounts, sized and priced before they start."
        actions={
          can("deploy") && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("deploy")}>
              Deploy a model
            </Button>
          )
        }
      >
        {deployments.isLoading ? (
          <CardSkeleton />
        ) : (
          <DeploymentList
            deployments={deployments.data ?? []}
            onOpen={(deployment) => open("deployments", deployment.id)}
          />
        )}
      </ModelsSection>

      <RoutesSection />

      <DeployDialog
        open={dialog === "deploy"}
        onOpenChange={(value) => setDialog(value ? "deploy" : null)}
      />
      <CreateAliasDialog
        open={dialog === "alias"}
        onOpenChange={(value) => setDialog(value ? "alias" : null)}
      />
    </div>
  );
}
