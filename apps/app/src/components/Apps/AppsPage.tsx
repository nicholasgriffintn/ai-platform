import {
  ExperienceGrid,
  ManageCapabilitiesLink,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
  ButtonLink,
  CardGridLoadingSkeleton,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import type { ProjectExperienceDefinition } from "@ngriffin_uk/polychat-schemas";
import { Puzzle } from "lucide-react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import {
  type CapabilitySurface,
  type EnabledCapability,
  getCapabilityLibraryPath,
  getEnabledExperiences,
  getExperiencePath,
} from "~/lib/capability-surfaces";
import { isAuthenticationError } from "~/lib/errors";

export interface AppsPageProjectScope {
  name?: string;
  capabilities?: EnabledCapability[];
  isLoading: boolean;
  error?: Error | null;
}

export function AppsPage({
  surface,
  project,
}: {
  surface: CapabilitySurface;
  project?: AppsPageProjectScope;
}) {
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCapabilityCatalog();
  const libraryPath = getCapabilityLibraryPath(surface);
  const experiences: ProjectExperienceDefinition[] = project
    ? getEnabledExperiences(project.capabilities ?? [], catalog?.experiences ?? [])
    : (catalog?.experiences ?? []);
  const isLoading = isCatalogLoading || Boolean(project?.isLoading);
  const pageError = project?.error ?? catalogError;

  return (
    <PageShell.Content className="max-w-6xl">
      <PageShell.Header
        title="Apps"
        actionContent={<ManageCapabilitiesLink href={libraryPath} />}
      />
      <p className="text-muted-foreground mb-6 max-w-3xl text-sm">
        {project
          ? `Longer jobs enabled for ${project.name ?? "this project"}: writing, reading, listening and making things.`
          : "Longer jobs that need more room than a message: writing, reading, listening and making things."}
      </p>

      {isLoading ? (
        <CardGridLoadingSkeleton
          count={6}
          gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          label="Loading apps"
        />
      ) : isAuthenticationError(pageError) ? (
        <SignInEmptyState
          title="Sign in to open apps"
          message="Your notes, articles, recordings and patterns live behind sign-in."
          className="min-h-[300px]"
        />
      ) : pageError ? (
        <EmptyState title="Apps unavailable" message={pageError.message} />
      ) : experiences.length === 0 ? (
        <EmptyState
          icon={<Puzzle size={24} className="text-muted-foreground" />}
          title={project ? "No apps enabled" : "Nothing to open yet"}
          message={
            project
              ? "Add an app to this project to open it here."
              : "Apps will appear here once the catalogue loads."
          }
          action={
            <ButtonLink variant="primary" href={libraryPath}>
              Browse teammates and tools
            </ButtonLink>
          }
          className="min-h-[260px]"
        />
      ) : (
        <ExperienceGrid
          experiences={experiences.map((experience) => ({
            ...experience,
            href: getExperiencePath(surface, experience.id),
          }))}
        />
      )}
    </PageShell.Content>
  );
}
