import { Button, CardSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";

import { PageShell } from "../../../Shell/PageShell.js";
import type { ModelPlace } from "../modelPaths.js";
import { ModelsScopeProvider, useModelsScope } from "../ModelsScope.js";

function BackToPlace({ place, label }: { place: ModelPlace; label: string }) {
  const { goTo } = useModelsScope();

  return (
    <Button size="sm" variant="ghost" onClick={() => goTo(place)}>
      ← {label}
    </Button>
  );
}

export function ModelObjectPage({
  workspaceId,
  projectId,
  place,
  placeLabel,
  title,
  isLoading,
  error,
  children,
}: {
  workspaceId: string;
  projectId?: string;
  place: ModelPlace;
  placeLabel: string;
  title: string | undefined;
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  return (
    <ModelsScopeProvider workspaceId={workspaceId} projectId={projectId}>
      <PageShell.Content className="max-w-6xl">
        {isLoading ? (
          <CardSkeleton />
        ) : title === undefined ? (
          <EmptyState
            title="Not found"
            message={getErrorMessage(error, "This is not in the workspace.")}
            className="min-h-[240px]"
          />
        ) : (
          <>
            <PageShell.Header title={title} />
            <div className="space-y-6">
              <BackToPlace place={place} label={placeLabel} />
              {children}
            </div>
          </>
        )}
      </PageShell.Content>
    </ModelsScopeProvider>
  );
}
