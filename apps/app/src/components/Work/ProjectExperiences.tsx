import { ArrowRight, Puzzle } from "lucide-react";
import { Link } from "react-router";

import { getIcon, getIconContainerClass } from "~/components/Apps/utils";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { Button, Card } from "~/components/ui";
import { useDynamicApps } from "~/hooks/useDynamicApps";
import { useProject } from "~/hooks/useWorkspaces";
import { getEnabledProjectExperiences, getProjectExperiencePath } from "~/lib/project-experiences";
import { cn } from "~/lib/utils";
import { WorkCardGridSkeleton } from "./WorkLoadingSkeletons";
import { WorkPageShell } from "./WorkPageShell";

export function ProjectExperiences({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { data: project, isLoading, error } = useProject(projectId);
	const { data: dynamicApps, isLoading: isCatalogLoading, error: catalogError } = useDynamicApps();
	const experiences = getEnabledProjectExperiences(
		project?.capabilities ?? [],
		dynamicApps?.experiences ?? [],
		dynamicApps?.apps ?? [],
	);
	const libraryPath = `/work/${workspaceId}/projects/${projectId}/library`;
	const pageError = error ?? catalogError;

	return (
		<WorkPageShell workspaceId={workspaceId} projectId={projectId}>
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<PageHeader>
					<div className="flex items-start justify-between gap-4">
						<div>
							<PageTitle title="Experiences" />
							<p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
								Open the richer tools enabled for {project?.name ?? "this project"}.
							</p>
						</div>
						<Link to={libraryPath}>
							<Button variant="outline">Manage capabilities</Button>
						</Link>
					</div>
				</PageHeader>

				{isLoading || isCatalogLoading ? (
					<WorkCardGridSkeleton
						count={6}
						gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
						label="Loading project experiences"
					/>
				) : pageError ? (
					<EmptyState title="Experiences unavailable" message={pageError.message} />
				) : experiences.length === 0 ? (
					<EmptyState
						icon={<Puzzle size={24} className="text-zinc-400" />}
						title="No rich experiences enabled"
						message="Add an app or recipe capability to use its project workspace."
						action={
							<Link to={libraryPath}>
								<Button variant="primary">Browse capabilities</Button>
							</Link>
						}
						className="min-h-[260px]"
					/>
				) : (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{experiences.map((experience) => {
							return (
								<Link
									key={experience.id}
									to={getProjectExperiencePath(workspaceId, projectId, experience.id)}
									className="group no-underline"
								>
									<Card className="h-full gap-5 p-6 shadow-none transition-colors group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
										<div className="flex items-start justify-between">
											<span
												className={cn(
													"flex h-10 w-10 items-center justify-center rounded-xl",
													getIconContainerClass(experience.theme),
												)}
											>
												{getIcon(experience.icon, experience.theme)}
											</span>
											<ArrowRight size={17} className="text-zinc-400" />
										</div>
										<div>
											<p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
												{experience.category}
											</p>
											<h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
												{experience.name}
											</h2>
											<p className="mt-2 text-sm leading-6 text-zinc-500">
												{experience.description}
											</p>
										</div>
									</Card>
								</Link>
							);
						})}
					</div>
				)}
			</main>
		</WorkPageShell>
	);
}
