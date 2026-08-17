import { ProjectKnowledgeCard as ControlledProjectKnowledgeCard } from "@ngriffin_uk/polychat-component-workspaces";
import { toast } from "sonner";

import {
	useProjectContextSources,
	useSetProjectContextSources,
	useSources,
} from "~/hooks/useSources";

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
			sourcesHref={`/work/${workspaceId}/projects/${projectId}/sources`}
			isSavingContext={setContext.isPending}
			onSaveContext={async (sourceIds) => {
				await setContext.mutateAsync(sourceIds);
				toast.success("Project context updated");
			}}
		/>
	);
}
