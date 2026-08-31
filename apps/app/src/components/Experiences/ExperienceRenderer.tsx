import { ContentLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectExperienceRuntime } from "@ngriffin_uk/polychat-schemas";
import { lazy, Suspense } from "react";

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
  const module = await import("./ArticlesExperience");

  return { default: module.ArticlesExperience };
});
const NotesExperience = lazy(async () => {
  const module = await import("./NotesExperience");

  return { default: module.NotesExperience };
});
const PodcastsExperience = lazy(async () => {
  const module = await import("./PodcastsExperience");

  return { default: module.PodcastsExperience };
});
const ResponsesExperience = lazy(async () => {
  const module = await import("./ResponsesExperience");

  return { default: module.ResponsesExperience };
});
const StrudelExperience = lazy(async () => {
  const module = await import("./StrudelExperience");

  return { default: module.StrudelExperience };
});
const LeanProofExperience = lazy(async () => {
  const module = await import("./LeanProofExperience");

  return { default: module.LeanProofExperience };
});

function ReplicateExperience({
  basePath,
  projectId,
  subpath,
}: {
  basePath: string;
  projectId?: string;
  subpath: string;
}) {
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
  projectBasePath,
  projectId,
  repository,
  runtime,
  subpath,
}: ExperienceRendererProps) {
  if (runtime === "replicate") {
    return <ReplicateExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "finetuning") {
    return <TrainingDashboard />;
  }

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

  if (runtime === "lean-proofs") {
    if (!projectId || !projectBasePath) {
      return (
        <EmptyState
          title="Project required"
          message="Lean Proofs is available from a Work project with a connected coding repository."
        />
      );
    }

    return (
      <LeanProofExperience
        basePath={basePath}
        projectBasePath={projectBasePath}
        projectId={projectId}
        repository={repository ?? null}
        subpath={subpath}
      />
    );
  }

  return <EmptyState title="Experience unavailable" message="This experience is not supported." />;
}

interface ExperienceRendererProps {
  basePath: string;
  projectBasePath?: string;
  projectId?: string;
  repository?: string | null;
  runtime: ProjectExperienceRuntime;
  subpath: string;
}

export function ExperienceRenderer(props: ExperienceRendererProps) {
  return (
    <Suspense fallback={<ContentLoadingSkeleton />}>
      <ExperienceContent {...props} />
    </Suspense>
  );
}
