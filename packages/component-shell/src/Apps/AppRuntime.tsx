import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { AppEntry, ProjectExperienceRuntime } from "@ngriffin_uk/polychat-schemas";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

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
const PolisApp = lazy(async () => {
  const module = await import("./Polis/PolisApp.js");

  return { default: module.PolisApp };
});
const BenchmarksApp = lazy(async () => {
  const module = await import("../Benchmarks/app/BenchmarksApp.js");

  return { default: module.BenchmarksApp };
});
const SitesApp = lazy(async () => {
  const module = await import("./Sites/SitesApp.js");

  return { default: module.SitesApp };
});

interface BundledAppProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}

const BUNDLED_APPS: Record<ProjectExperienceRuntime, ComponentType<BundledAppProps>> = {
  benchmarks: BenchmarksApp,
  charades: CharadesApp,
  "photo-sorter": PhotoSorterApp,
  polis: PolisApp,
  sites: SitesApp,
  strudel: StrudelApp,
  "twenty-questions": TwentyQuestionsApp,
  verbatim: VerbatimApp,
};

interface AppRuntimeProps extends BundledAppProps {
  entry: AppEntry | undefined;
  fallback?: ReactNode;
}

function ExperienceContent({ entry, ...props }: Omit<AppRuntimeProps, "fallback">) {
  const App = entry?.kind === "bundled" ? BUNDLED_APPS[entry.runtime] : undefined;

  if (!App) {
    return (
      <EmptyState title="Experience unavailable" message="This experience is not supported." />
    );
  }

  return <App {...props} />;
}

export function AppRuntime(props: AppRuntimeProps) {
  const { fallback, ...contentProps } = props;

  return (
    <Suspense fallback={fallback}>
      <ExperienceContent {...contentProps} />
    </Suspense>
  );
}
