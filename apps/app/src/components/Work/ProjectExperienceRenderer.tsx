import { lazy, Suspense } from "react";

import { EmptyState } from "~/components/Core/EmptyState";
import { getProjectExperiencePath } from "~/lib/project-experiences";
import { ProjectOverviewSkeleton } from "./WorkLoadingSkeletons";

const ReplicateModelDetail = lazy(async () => {
	const module = await import("~/components/Replicate/ReplicateModelDetail");
	return { default: module.ReplicateModelDetail };
});
const ReplicateModels = lazy(async () => {
	const module = await import("~/components/Replicate/ReplicateModels");
	return { default: module.ReplicateModels };
});
const ReplicatePredictionDetail = lazy(async () => {
	const module = await import("~/components/Replicate/ReplicatePredictionDetail");
	return { default: module.ReplicatePredictionDetail };
});
const ReplicatePredictions = lazy(async () => {
	const module = await import("~/components/Replicate/ReplicatePredictions");
	return { default: module.ReplicatePredictions };
});
const TrainingDashboard = lazy(async () => {
	const module = await import("~/components/Training/TrainingDashboard");
	return { default: module.TrainingDashboard };
});
const ArticlesExperience = lazy(async () => {
	const module = await import("./Experiences/ArticlesExperience");
	return { default: module.ArticlesExperience };
});
const NotesExperience = lazy(async () => {
	const module = await import("./Experiences/NotesExperience");
	return { default: module.NotesExperience };
});
const PodcastsExperience = lazy(async () => {
	const module = await import("./Experiences/PodcastsExperience");
	return { default: module.PodcastsExperience };
});
const ResponsesExperience = lazy(async () => {
	const module = await import("./Experiences/ResponsesExperience");
	return { default: module.ResponsesExperience };
});
const StrudelExperience = lazy(async () => {
	const module = await import("./Experiences/StrudelExperience");
	return { default: module.StrudelExperience };
});

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

function ExperienceContent({
	basePath,
	projectId,
	runtime,
	subpath,
	workspaceId,
}: ProjectExperienceRendererProps) {
	if (runtime === "replicate") {
		return (
			<ReplicateExperience workspaceId={workspaceId} projectId={projectId} subpath={subpath} />
		);
	}
	if (runtime === "finetuning") return <TrainingDashboard />;
	if (runtime === "articles") {
		return <ArticlesExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
	}
	if (runtime === "podcasts") {
		return <PodcastsExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
	}
	if (runtime === "notes") {
		return <NotesExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
	}
	if (runtime === "strudel") {
		return <StrudelExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
	}
	if (runtime === "responses") {
		return <ResponsesExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
	}
	return (
		<EmptyState
			title="Experience unavailable"
			message="This project experience is not supported."
		/>
	);
}

interface ProjectExperienceRendererProps {
	basePath: string;
	projectId: string;
	runtime: string;
	subpath: string;
	workspaceId: string;
}

export function ProjectExperienceRenderer(props: ProjectExperienceRendererProps) {
	return (
		<Suspense fallback={<ProjectOverviewSkeleton />}>
			<ExperienceContent {...props} />
		</Suspense>
	);
}
