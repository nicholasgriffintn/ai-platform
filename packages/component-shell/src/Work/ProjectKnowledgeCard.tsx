import { ProjectKnowledgeCard as ControlledProjectKnowledgeCard } from "@ngriffin_uk/polychat-component-workspaces";
import {
  useMemoryDocuments,
  useProjectContextSources,
  useSetProjectContextSources,
  useSources,
  getProjectFilesPath,
} from "@ngriffin_uk/polychat-library-react";
import { toast } from "sonner";

import { KnowledgeReadingSettings } from "../Knowledge/KnowledgeReadingSettings.js";

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
  const memories = useMemoryDocuments(projectId);
  const allSources = useSources({ projectId });
  const context = useProjectContextSources(projectId);
  const setContext = useSetProjectContextSources(projectId);

  return (
    <ControlledProjectKnowledgeCard
      canManage={canManage}
      embedded={embedded}
      memories={memories.documents.map((document) => ({
        id: document.id,
        title: document.name,
        kind: "memory",
      }))}
      contextSources={context.data ?? []}
      contextCandidates={(allSources.data ?? []).filter(
        (source) => source.kind !== "memory" && source.status === "available",
      )}
      sourcesHref={getProjectFilesPath(workspaceId, projectId, "sources")}
      isSavingContext={setContext.isPending}
      readingSettings={<KnowledgeReadingSettings projectId={projectId} />}
      onSaveContext={async (sourceIds) => {
        await setContext.mutateAsync(sourceIds);
        toast.success("Project context updated");
      }}
    />
  );
}
