import {
	ExperienceGrid,
	ManageCapabilitiesLink,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
	Button,
	CardGridLoadingSkeleton,
	EmptyState,
	Link,
} from "@ngriffin_uk/polychat-component-ui";
import { Puzzle } from "lucide-react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import {
	getEnabledExperiences,
	getExperiencePath,
	getProjectSurface,
} from "~/lib/capability-surfaces";
import { isAuthenticationError } from "~/lib/errors";
import { useWorkData } from "./WorkContext";

export function ProjectExperiences({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { projectQuery } = useWorkData();
	const { data: project, isLoading, error } = projectQuery;
	const {
		data: catalog,
		isLoading: isCatalogLoading,
		error: catalogError,
	} = useCapabilityCatalog();
	const experiences = getEnabledExperiences(
		project?.capabilities ?? [],
		catalog?.experiences ?? [],
	);
	const libraryPath = `/work/${workspaceId}/projects/${projectId}/library`;
	const pageError = error ?? catalogError;

	return (
		<PageShell.Content className="max-w-6xl">
			<PageShell.Header
				title="Experiences"
				actionContent={<ManageCapabilitiesLink href={libraryPath} />}
			/>
			<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
				Open the richer tools enabled for {project?.name ?? "this project"}.
			</p>

			{isLoading || isCatalogLoading ? (
				<CardGridLoadingSkeleton
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
			) : experiences.length === 0 ? (
				<EmptyState
					icon={<Puzzle size={24} className="text-zinc-400" />}
					title="No rich experiences enabled"
					message="Add an app or recipe capability to use its project workspace."
					action={
						<Link href={libraryPath}>
							<Button variant="primary">Browse capabilities</Button>
						</Link>
					}
					className="min-h-[260px]"
				/>
			) : (
				<ExperienceGrid
					experiences={experiences.map((experience) => ({
						...experience,
						href: getExperiencePath(getProjectSurface(workspaceId, projectId), experience.id),
					}))}
				/>
			)}
		</PageShell.Content>
	);
}
