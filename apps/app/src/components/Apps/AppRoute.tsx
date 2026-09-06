import {
  BackLink,
  ButtonLink,
  ContentLoadingSkeleton,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { Puzzle } from "lucide-react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { ExperienceRenderer } from "~/components/Experiences/ExperienceRenderer";
import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import {
  type CapabilitySurface,
  getCapabilityLibraryPath,
  getExperienceBackLink,
  getExperiencePath,
  isExperienceEnabled,
} from "~/lib/capability-surfaces";
import { isAuthenticationError } from "~/lib/errors";

import type { AppsPageProjectScope } from "./AppsPage";

export function AppRoute({
  experienceId,
  project,
  subpath = "",
  surface,
}: {
  experienceId: string;
  project?: AppsPageProjectScope;
  subpath?: string;
  surface: CapabilitySurface;
}) {
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCapabilityCatalog();
  const definition = catalog?.experiences.find((item) => item.id === experienceId);
  const title = definition?.name;
  const backLink = getExperienceBackLink(surface, experienceId, subpath, title);
  const basePath = getExperiencePath(surface, experienceId);
  const isLoading = isCatalogLoading || Boolean(project?.isLoading);
  const pageError = project?.error ?? catalogError;
  const isEnabled =
    !project || (definition ? isExperienceEnabled(definition, project.capabilities ?? []) : false);

  return (
    <PageShell.Content className="max-w-7xl">
      <PageShell.Header title={title ?? "App"} />
      <BackLink href={backLink.to} label={backLink.label} />
      {definition && (
        <p className="text-muted-foreground mb-6 max-w-3xl text-sm">{definition.description}</p>
      )}

      {isLoading ? (
        <ContentLoadingSkeleton />
      ) : isAuthenticationError(pageError) ? (
        <SignInEmptyState
          title="Sign in to open this app"
          message="This app keeps your work, so it needs an account."
          className="min-h-[300px]"
        />
      ) : pageError ? (
        <EmptyState title="App unavailable" message={pageError.message} />
      ) : !definition ? (
        <EmptyState title="App not found" message="This app does not exist." />
      ) : !isEnabled ? (
        <EmptyState
          icon={<Puzzle size={24} className="text-muted-foreground" />}
          title="App not enabled"
          message={`Add ${title} to the project before opening it.`}
          action={
            <ButtonLink variant="primary" href={getCapabilityLibraryPath(surface)}>
              Manage teammates and tools
            </ButtonLink>
          }
        />
      ) : (
        <ExperienceRenderer
          basePath={basePath}
          projectId={surface.projectId}
          runtime={definition.runtime}
          subpath={subpath}
        />
      )}
    </PageShell.Content>
  );
}
