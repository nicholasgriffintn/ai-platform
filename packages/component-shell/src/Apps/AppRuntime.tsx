import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type {
  AppSurfaceDefinition,
  ProjectExperienceDefinition,
  ProjectExperienceRuntime,
} from "@ngriffin_uk/polychat-schemas";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

import { CONTAINED_APP_PRESENTATION } from "./AppSurface.js";
import { RemoteMcpApp } from "./RemoteMcpApp.js";

const BenchmarksApp = lazy(async () => {
  const module = await import("../Benchmarks/app/BenchmarksApp.js");

  return { default: module.BenchmarksApp };
});
const SitesApp = lazy(async () => {
  const module = await import("./Sites/SitesApp.js");

  return { default: module.SitesApp };
});

interface AppRuntimeLocation {
  basePath: string;
  projectId?: string;
  subpath: string;
}

interface BundledAppProps extends AppRuntimeLocation {
  presentation: AppSurfaceDefinition;
}

const BUNDLED_APPS: Record<ProjectExperienceRuntime, ComponentType<BundledAppProps>> = {
  benchmarks: BenchmarksApp,
  sites: SitesApp,
};

interface AppRuntimeProps extends AppRuntimeLocation {
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

  return <App {...props} presentation={app?.surface ?? CONTAINED_APP_PRESENTATION} />;
}

export function AppRuntime(props: AppRuntimeProps) {
  return (
    <Suspense fallback={props.fallback}>
      <ExperienceContent {...props} />
    </Suspense>
  );
}
