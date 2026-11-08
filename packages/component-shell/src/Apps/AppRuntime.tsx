import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type {
  ProjectExperienceDefinition,
  ProjectExperienceRuntime,
} from "@ngriffin_uk/polychat-schemas";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

import { RemoteMcpApp } from "./RemoteMcpApp.js";

const StrudelApp = lazy(async () => {
  const module = await import("./StrudelApp.js");

  return { default: module.StrudelApp };
});
const VerbatimApp = lazy(async () => {
  const module = await import("./Verbatim/VerbatimApp.js");

  return { default: module.VerbatimApp };
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
  polis: PolisApp,
  sites: SitesApp,
  strudel: StrudelApp,
  verbatim: VerbatimApp,
};

interface AppRuntimeProps extends BundledAppProps {
  app: ProjectExperienceDefinition | undefined;
  fallback?: ReactNode;
}

function ExperienceContent({ app, fallback, ...props }: AppRuntimeProps) {
  const entry = app?.entry;

  if (app && entry?.kind === "remote") {
    return <RemoteMcpApp app={app} entry={entry} fallback={fallback} />;
  }

  const App = entry?.kind === "bundled" ? BUNDLED_APPS[entry.runtime] : undefined;

  if (!App) {
    return (
      <EmptyState title="Experience unavailable" message="This experience is not supported." />
    );
  }

  return <App {...props} />;
}

export function AppRuntime(props: AppRuntimeProps) {
  return (
    <Suspense fallback={props.fallback}>
      <ExperienceContent {...props} />
    </Suspense>
  );
}
