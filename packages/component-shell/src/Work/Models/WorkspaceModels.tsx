import {
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";

import { PageShell } from "../../Shell/PageShell.js";
import { useWorkData } from "../WorkDataContext.js";
import { BuildTab } from "./BuildTab.js";
import { EvaluateTab } from "./EvaluateTab.js";
import { GovernTab } from "./GovernTab.js";
import { LibraryTab } from "./LibraryTab.js";
import { RunTab } from "./RunTab.js";

export function WorkspaceModels({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId?: string;
}) {
  const { workspaceQuery, projectQuery } = useWorkData();
  const role = workspaceQuery.data?.role;
  const canGovern = role === "owner" || role === "admin";
  const scopeName = projectId ? projectQuery.data?.name : workspaceQuery.data?.name;

  if (workspaceQuery.error) {
    return (
      <EmptyState
        title="Models unavailable"
        message="You need to be a member of this workspace to see its models."
        className="min-h-[240px]"
      />
    );
  }

  return (
    <PageShell.Content className="max-w-6xl">
      <PageShell.Header title="Models" />
      <div className="space-y-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Find, vet, evaluate, fine-tune and serve open models for {scopeName ?? "this scope"}.
          Every approval cites an exact commit and the evidence behind it.
        </p>
        <Tabs defaultValue="library" className="space-y-6">
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="evaluate">Evaluate</TabsTrigger>
            <TabsTrigger value="build">Build</TabsTrigger>
            <TabsTrigger value="run">Run</TabsTrigger>
            {canGovern && <TabsTrigger value="govern">Govern</TabsTrigger>}
          </TabsList>
          <TabsContent value="library">
            <LibraryTab workspaceId={workspaceId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="evaluate">
            <EvaluateTab workspaceId={workspaceId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="build">
            <BuildTab workspaceId={workspaceId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="run">
            <RunTab workspaceId={workspaceId} projectId={projectId} canGovern={canGovern} />
          </TabsContent>
          {canGovern && (
            <TabsContent value="govern">
              <GovernTab
                workspaceId={workspaceId}
                projectId={projectId}
                projectName={projectQuery.data?.name}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageShell.Content>
  );
}
