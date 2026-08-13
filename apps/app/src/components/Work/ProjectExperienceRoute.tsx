import { Puzzle } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { BackLink } from "~/components/Core/BackLink";
import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useDynamicApps } from "~/hooks/useDynamicApps";
import {
	getProjectExperiencePath,
	getProjectExperiencesPath,
	isProjectExperienceEnabled,
} from "~/lib/project-experiences";
import { useWorkData } from "./WorkContext";
import { ProjectOverviewSkeleton } from "./WorkLoadingSkeletons";
import { ProjectExperienceRenderer } from "./ProjectExperienceRenderer";
import { isAuthenticationError } from "~/lib/errors";

export function ProjectExperienceRoute({
	experienceId,
	projectId,
	subpath = "",
	workspaceId,
}: {
	experienceId: string;
	projectId: string;
	subpath?: string;
	workspaceId: string;
}) {
	const { projectQuery } = useWorkData();
	const { data: project, isLoading, error } = projectQuery;
	const { data: dynamicApps, isLoading: isCatalogLoading, error: catalogError } = useDynamicApps();
	const hubPath = getProjectExperiencesPath(workspaceId, projectId);
	const definition = dynamicApps?.experiences.find((item) => item.id === experienceId);
	const title = definition?.name;
	const basePath = getProjectExperiencePath(workspaceId, projectId, experienceId);

	const isEnabled =
		project &&
		definition &&
		isProjectExperienceEnabled(definition, project.capabilities, dynamicApps?.apps ?? []);
	const pageError = error ?? catalogError;

	return (
		<>
			<PageShell.Content className="max-w-7xl">
				<PageShell.Header title={title ?? "Experience"} />
				<BackLink to={hubPath} label="Back to experiences" />
				{definition && (
					<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
						{definition.description}
					</p>
				)}

				{isLoading || isCatalogLoading ? (
					<ProjectOverviewSkeleton />
				) : isAuthenticationError(pageError) ? (
					<SignInEmptyState
						title="Sign in to open this experience"
						message="Sign in to access this project experience."
						className="min-h-[300px]"
					/>
				) : pageError || !project ? (
					<EmptyState
						title="Experience unavailable"
						message={pageError?.message ?? "Project not found"}
					/>
				) : !definition ? (
					<EmptyState
						title="Experience not found"
						message="This project experience does not exist."
					/>
				) : !isEnabled ? (
					<EmptyState
						icon={<Puzzle size={24} className="text-zinc-400" />}
						title="Capability not enabled"
						message={`Add ${title} to the project before opening this experience.`}
						action={
							<Link to={`/work/${workspaceId}/projects/${projectId}/library`}>
								<Button variant="primary">Manage capabilities</Button>
							</Link>
						}
					/>
				) : (
					<ProjectExperienceRenderer
						basePath={basePath}
						projectId={projectId}
						runtime={definition.runtime}
						subpath={subpath}
						workspaceId={workspaceId}
					/>
				)}
			</PageShell.Content>
		</>
	);
}
