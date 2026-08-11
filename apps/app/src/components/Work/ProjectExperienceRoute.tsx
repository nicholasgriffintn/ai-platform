import { Puzzle } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { ReplicateModelDetail } from "~/components/Replicate/ReplicateModelDetail";
import { ReplicateModels } from "~/components/Replicate/ReplicateModels";
import { ReplicatePredictionDetail } from "~/components/Replicate/ReplicatePredictionDetail";
import { ReplicatePredictions } from "~/components/Replicate/ReplicatePredictions";
import { TrainingDashboard } from "~/components/Training/TrainingDashboard";
import { Button } from "~/components/ui";
import { useDynamicApps } from "~/hooks/useDynamicApps";
import {
	getProjectExperiencePath,
	getProjectExperiencesPath,
	isProjectExperienceEnabled,
} from "~/lib/project-experiences";
import { useWorkData } from "./WorkContext";
import { ProjectOverviewSkeleton } from "./WorkLoadingSkeletons";
import { isAuthenticationError } from "~/lib/errors";
import { ArticlesExperience } from "./Experiences/ArticlesExperience";
import { NotesExperience } from "./Experiences/NotesExperience";
import { PodcastsExperience } from "./Experiences/PodcastsExperience";
import { ResponsesExperience } from "./Experiences/ResponsesExperience";
import { StrudelExperience } from "./Experiences/StrudelExperience";

function ReplicateExperience({
	workspaceId,
	projectId,
	subpath,
}: {
	workspaceId: string;
	projectId: string;
	subpath: string;
}) {
	const basePath = getProjectExperiencePath(workspaceId, projectId, "replicate");
	const segments = subpath.split("/").filter(Boolean);

	if (segments[0] === "predictions" && segments[1]) {
		return <ReplicatePredictionDetail predictionId={segments[1]} projectId={projectId} />;
	}
	if (segments[0] === "predictions") {
		return <ReplicatePredictions basePath={basePath} projectId={projectId} />;
	}
	if (segments[0]) {
		return <ReplicateModelDetail basePath={basePath} modelId={segments[0]} projectId={projectId} />;
	}
	return <ReplicateModels basePath={basePath} projectId={projectId} />;
}

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
			<main className="container mx-auto max-w-7xl px-4 py-8">
				<PageHeader>
					<BackLink to={hubPath} label="Back to experiences" />
					<PageTitle title={title ?? "Experience"} />
					{definition && (
						<p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
							{definition.description}
						</p>
					)}
				</PageHeader>

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
				) : definition.runtime === "replicate" ? (
					<ReplicateExperience workspaceId={workspaceId} projectId={projectId} subpath={subpath} />
				) : definition.runtime === "finetuning" ? (
					<TrainingDashboard />
				) : definition.runtime === "articles" ? (
					<ArticlesExperience basePath={basePath} projectId={projectId} subpath={subpath} />
				) : definition.runtime === "podcasts" ? (
					<PodcastsExperience basePath={basePath} projectId={projectId} subpath={subpath} />
				) : definition.runtime === "notes" ? (
					<NotesExperience basePath={basePath} projectId={projectId} subpath={subpath} />
				) : definition.runtime === "strudel" ? (
					<StrudelExperience basePath={basePath} projectId={projectId} subpath={subpath} />
				) : definition.runtime === "responses" ? (
					<ResponsesExperience basePath={basePath} projectId={projectId} subpath={subpath} />
				) : (
					<EmptyState
						title="Experience unavailable"
						message="This project experience is not supported."
					/>
				)}
			</main>
		</>
	);
}
