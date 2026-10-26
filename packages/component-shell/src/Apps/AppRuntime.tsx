import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { lazy, Suspense, type ReactNode } from "react";

const StrudelApp = lazy(async () => {
  const module = await import("./StrudelApp.js");

  return { default: module.StrudelApp };
});
const VerbatimApp = lazy(async () => {
  const module = await import("./Verbatim/VerbatimApp.js");

  return { default: module.VerbatimApp };
});
const CharadesApp = lazy(async () => {
  const module = await import("./Charades/CharadesApp.js");

  return { default: module.CharadesApp };
});
const PhotoSorterApp = lazy(async () => {
  const module = await import("./PhotoSorter/PhotoSorterApp.js");

  return { default: module.PhotoSorterApp };
});
const TwentyQuestionsApp = lazy(async () => {
  const module = await import("./TwentyQuestions/TwentyQuestionsApp.js");

  return { default: module.TwentyQuestionsApp };
});
const BenchmarksApp = lazy(async () => {
  const module = await import("../Benchmarks/app/BenchmarksApp.js");

  return { default: module.BenchmarksApp };
});
const SitesApp = lazy(async () => {
  const module = await import("./Sites/SitesApp.js");

  return { default: module.SitesApp };
});

function ExperienceContent({ basePath, projectId, runtime, subpath }: AppRuntimeProps) {
  if (runtime === "strudel") {
    return <StrudelApp basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "sites") {
    return <SitesApp basePath={basePath} projectId={projectId} subpath={subpath} />;
  }

  if (runtime === "verbatim") {
    return <VerbatimApp projectId={projectId} />;
  }

  if (runtime === "charades") {
    return <CharadesApp />;
  }

  if (runtime === "photo-sorter") {
    return <PhotoSorterApp />;
  }

  if (runtime === "benchmarks") {
    return <BenchmarksApp basePath={basePath} subpath={subpath} />;
  }

  if (runtime === "twenty-questions") {
    return <TwentyQuestionsApp projectId={projectId} />;
  }

  return <EmptyState title="Experience unavailable" message="This experience is not supported." />;
}

interface AppRuntimeProps {
  basePath: string;
  fallback?: ReactNode;
  projectId?: string;
  runtime: string;
  subpath: string;
}

export function AppRuntime(props: AppRuntimeProps) {
  const { fallback, ...contentProps } = props;

  return (
    <Suspense fallback={fallback}>
      <ExperienceContent {...contentProps} />
    </Suspense>
  );
}
