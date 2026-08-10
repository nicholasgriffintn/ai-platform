import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { useAssistantActionCatalog } from "~/hooks/useAssistantActionCatalog";
import {
	useAddProjectCapability,
	useProject,
	useRemoveProjectCapability,
	useWorkspace,
} from "~/hooks/useWorkspaces";
import { MODEL_TOOL_DEFINITIONS } from "~/lib/model-tools";
import {
	filterProjectCapabilities,
	getProjectCapabilityCategories,
	getProjectCapabilityKind,
	groupProjectCapabilities,
	type ProjectCapabilityKindFilter,
} from "~/lib/project-capability-catalog";
import { ProjectCapabilityFilters } from "./ProjectCapabilityFilters";
import { ProjectCapabilityGroups } from "./ProjectCapabilityGroups";
import { WorkCardGridSkeleton } from "./WorkLoadingSkeletons";
import { WorkPageShell } from "./WorkPageShell";

export function ProjectLibrary({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { data: project, isLoading } = useProject(projectId);
	const { data: workspace } = useWorkspace(workspaceId);
	const catalog = useAssistantActionCatalog({ modelTools: MODEL_TOOL_DEFINITIONS });
	const addCapability = useAddProjectCapability();
	const removeCapability = useRemoveProjectCapability();
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<ProjectCapabilityKindFilter>("all");
	const [category, setCategory] = useState("all");

	const items = useMemo(
		() =>
			catalog.items.filter(
				(item) =>
					getProjectCapabilityKind(item) !== null &&
					(item.kind !== "app" || item.metadata?.appKind === "dynamic"),
			),
		[catalog.items],
	);
	const categories = useMemo(() => getProjectCapabilityCategories(items, kind), [items, kind]);
	const visibleItems = useMemo(
		() => filterProjectCapabilities(items, { category, kind, query }),
		[category, items, kind, query],
	);
	const groups = useMemo(() => groupProjectCapabilities(visibleItems), [visibleItems]);
	const canManage = workspace?.role === "owner" || workspace?.role === "admin";

	const handleKindChange = (nextKind: ProjectCapabilityKindFilter) => {
		setKind(nextKind);
		setCategory("all");
	};

	return (
		<WorkPageShell workspaceId={workspaceId} projectId={projectId}>
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<PageHeader>
					<PageTitle title="Capabilities" />
					<p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
						Choose which apps, recipes, and tools are available in {project?.name ?? "this project"}
						.
					</p>
				</PageHeader>

				<ProjectCapabilityFilters
					categories={categories}
					category={category}
					kind={kind}
					onCategoryChange={setCategory}
					onKindChange={handleKindChange}
					onQueryChange={setQuery}
					query={query}
				/>

				{isLoading ? (
					<WorkCardGridSkeleton count={6} label="Loading project capabilities" />
				) : groups.length === 0 ? (
					<EmptyState
						icon={<SearchX size={24} className="text-zinc-400" />}
						title="No matching capabilities"
						message="Try another search, type, or category."
						className="min-h-[240px]"
					/>
				) : (
					<ProjectCapabilityGroups
						canManage={canManage}
						capabilities={project?.capabilities ?? []}
						groups={groups}
						isAdding={addCapability.isPending}
						isRemoving={removeCapability.isPending}
						onAdd={(item, itemKind) =>
							addCapability.mutate({
								projectId,
								input: {
									kind: itemKind,
									capabilityId: item.capability.id,
									configuration: {},
								},
							})
						}
						onRemove={(existing) =>
							removeCapability.mutate({ projectId, capabilityId: existing.id })
						}
						projectId={projectId}
						workspaceId={workspaceId}
					/>
				)}
			</main>
		</WorkPageShell>
	);
}
