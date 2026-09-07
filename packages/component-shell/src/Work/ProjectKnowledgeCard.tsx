import { ProjectKnowledgeCard as ControlledProjectKnowledgeCard } from "@ngriffin_uk/polychat-component-workspaces";
import {
  useProjectContextSources,
  useSetProjectContextSources,
  useSources,
  getProjectFilesPath,
} from "@ngriffin_uk/polychat-library-react";
import { toast } from "sonner";

export function ProjectKnowledgeCard({
  workspaceId,
  projectId,
  canManage,
  embedded = false,
}: {
  workspaceId: string;
  projectId: string;
  canManage: boolean;
  embedded?: boolean;
}) {
  const memories = useSources({ projectId, kind: "memory" });
  const allSources = useSources({ projectId });
  const context = useProjectContextSources(projectId);
  const setContext = useSetProjectContextSources(projectId);

  return (
    <ControlledProjectKnowledgeCard
      canManage={canManage}
      embedded={embedded}
      memories={memories.data ?? []}
      contextSources={context.data ?? []}
      contextCandidates={(allSources.data ?? []).filter(
        (source) => source.kind !== "memory" && source.status === "available",
      )}
      sourcesHref={getProjectFilesPath(workspaceId, projectId, "given")}
      isSavingContext={setContext.isPending}
      onSaveContext={async (sourceIds) => {
        await setContext.mutateAsync(sourceIds);
        toast.success("Project context updated");
      }}
    />
  );
}
