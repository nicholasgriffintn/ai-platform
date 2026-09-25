import { RouteHealthPanel, RouteList } from "@ngriffin_uk/polychat-component-models";
import { CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import {
  useModelRegistryMutations,
  useModelRouteHealth,
  useModelRoutes,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";
import { toast } from "sonner";

import { ModelsSection } from "./ModelsSection.js";

export function RunTab({
  workspaceId,
  projectId,
  canGovern,
}: {
  workspaceId: string;
  projectId?: string;
  canGovern: boolean;
}) {
  const routes = useModelRoutes(workspaceId, projectId);
  const mutations = useModelRegistryMutations(workspaceId);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const selected =
    routes.data?.find((route) => route.id === selectedRouteId) ??
    routes.data?.find((route) => route.status === "active");
  const health = useModelRouteHealth(workspaceId, selected?.id);

  const exportBom = async (versionId: string, routeId: string) => {
    try {
      const bom = await mutations.exportBom.mutateAsync({ versionId, routeId });

      downloadTextFile(
        `ml-bom-${routeId}.cdx.json`,
        JSON.stringify(bom, null, 2),
        "application/json",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Export failed"));
    }
  };

  if (routes.isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <ModelsSection
        title="Routes"
        description="Every provider, model and region pair this scope can serve from. Pick one to see its health."
      >
        <RouteList
          routes={routes.data ?? []}
          canGovern={canGovern}
          selectedRouteId={selected?.id}
          onSelect={(route) => setSelectedRouteId(route.id)}
          onRetire={(route) => void mutations.retireRoute.mutateAsync(route.id)}
          onExportBom={(route) => void exportBom(route.versionId, route.id)}
        />
      </ModelsSection>
      {selected && (
        <ModelsSection
          title="Health"
          description={`${selected.displayName} on ${selected.provider} · ${selected.region}`}
        >
          {health.isLoading || !health.data ? (
            <CardSkeleton />
          ) : (
            <RouteHealthPanel health={health.data} />
          )}
        </ModelsSection>
      )}
    </div>
  );
}
