import { ContentLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { lazy, Suspense } from "react";

const CanvasStudio = lazy(async () => {
  const module = await import("~/components/Canvas/CanvasStudio");

  return { default: module.CanvasStudio };
});
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
const ArticlesApp = lazy(async () => {
  const module = await import("./ArticlesApp");

  return { default: module.ArticlesApp };
});
const NotesApp = lazy(async () => {
  const module = await import("./NotesApp");

  return { default: module.NotesApp };
});
const RecordingsApp = lazy(async () => {
  const module = await import("./RecordingsApp");

  return { default: module.RecordingsApp };
});
const StrudelApp = lazy(async () => {
  const module = await import("./StrudelApp");

  return { default: module.StrudelApp };
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

function ExperienceContent({ basePath, projectId, runtime, subpath }: AppRuntimeProps) {
  if (runtime === "replicate") {
    return <ReplicateExperience basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "finetuning") {
    return <TrainingDashboard />;
  }

  if (runtime === "articles") {
    return <ArticlesApp basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "recordings") {
    return <RecordingsApp basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "notes") {
    return <NotesApp basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "image-studio") {
    return <CanvasStudio />;
  }

  if (runtime === "strudel") {
    return <StrudelApp basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  return <EmptyState title="Experience unavailable" message="This experience is not supported." />;
}

interface AppRuntimeProps {
  basePath: string;
  projectId?: string;
  runtime: string;
  subpath: string;
}

export function AppRuntime(props: AppRuntimeProps) {
  return (
    <Suspense fallback={<ContentLoadingSkeleton />}>
      <ExperienceContent {...props} />
    </Suspense>
  );
}
