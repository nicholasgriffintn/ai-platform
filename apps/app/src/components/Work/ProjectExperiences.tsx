import { ArrowRight, Puzzle, Settings2 } from "lucide-react";
import { Link } from "react-router";

import { getIcon, getIconContainerClass } from "~/components/Apps/utils";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import { useDynamicApps } from "~/hooks/useDynamicApps";
import {
	getEnabledProjectDynamicApps,
	getEnabledProjectExperiences,
	getProjectAppOpenPath,
	getProjectExperiencePath,
} from "~/lib/project-experiences";
import { useWorkData } from "./WorkContext";
import { cn } from "~/lib/utils";
import { isAuthenticationError } from "~/lib/errors";
import { WorkCardGridSkeleton } from "./WorkLoadingSkeletons";

export function ProjectExperiences({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { projectQuery } = useWorkData();
	const { data: project, isLoading, error } = projectQuery;
	const { data: dynamicApps, isLoading: isCatalogLoading, error: catalogError } = useDynamicApps();
	const experiences = getEnabledProjectExperiences(
		project?.capabilities ?? [],
		dynamicApps?.experiences ?? [],
		dynamicApps?.apps ?? [],
	);
	const enabledApps = getEnabledProjectDynamicApps(
		project?.capabilities ?? [],
		dynamicApps?.apps ?? [],
	);
	const libraryPath = `/work/${workspaceId}/projects/${projectId}/library`;
	const pageError = error ?? catalogError;

	return (
		<>
			<PageShell.Content className="max-w-6xl">
				<PageShell.Header
					title="Experiences"
					actionContent={
						<Link
							to={libraryPath}
							aria-label="Manage capabilities"
							title="Manage capabilities"
							className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-300 text-sm text-zinc-900 no-underline transition-colors hover:bg-zinc-100 hover:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto sm:px-3"
						>
							<Settings2 size={16} />
							<span className="hidden sm:inline">Manage capabilities</span>
						</Link>
					}
				/>
				<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
					Open the richer tools enabled for {project?.name ?? "this project"}.
				</p>

				{isLoading || isCatalogLoading ? (
					<WorkCardGridSkeleton
						count={6}
						gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
						label="Loading project experiences"
					/>
				) : isAuthenticationError(pageError) ? (
					<SignInEmptyState
						title="Sign in to view project experiences"
						message="Sign in to access the experiences enabled for this project."
						className="min-h-[300px]"
					/>
				) : pageError ? (
					<EmptyState title="Experiences unavailable" message={pageError.message} />
				) : experiences.length === 0 && enabledApps.length === 0 ? (
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
						{enabledApps.map((app) => (
							<Link
								key={`app:${app.id}`}
								to={getProjectAppOpenPath(app.id, app.kind, workspaceId, projectId, experiences)}
								className="group no-underline hover:!no-underline"
							>
								<Card className="h-full gap-5 p-6 shadow-none transition-colors group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
									<div className="flex items-start justify-between">
										<span
											className={cn(
												"flex h-10 w-10 items-center justify-center rounded-xl",
												getIconContainerClass(app.theme),
											)}
										>
											{getIcon(app.icon, app.theme)}
										</span>
										<ArrowRight size={17} className="text-zinc-400" />
									</div>
									<div>
										<p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
											{app.category || "App"}
										</p>
										<h2 className="mt-1 text-lg font-semibold text-zinc-950 group-hover:underline dark:text-white">
											{app.name}
										</h2>
										<p className="mt-2 text-sm leading-6 text-zinc-500">{app.description}</p>
									</div>
								</Card>
							</Link>
						))}
						{experiences.map((experience) => {
							return (
								<Link
									key={experience.id}
									to={getProjectExperiencePath(workspaceId, projectId, experience.id)}
									className="group no-underline hover:!no-underline"
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
											<h2 className="mt-1 text-lg font-semibold text-zinc-950 group-hover:underline dark:text-white">
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
			</PageShell.Content>
		</>
	);
}
