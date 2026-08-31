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
  getExperienceBackLink,
  getExperiencePath,
  getProjectSurface,
  isExperienceAvailableInScope,
  isExperienceEnabled,
} from "~/lib/capability-surfaces";
import { isAuthenticationError } from "~/lib/errors";

import { useWorkData } from "./WorkDataContext";

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
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCapabilityCatalog(projectId);
  const definition = catalog?.experiences.find(
    (item) => item.id === experienceId && isExperienceAvailableInScope(item, "project"),
  );
  const title = definition?.name;
  const backLink = getExperienceBackLink(
    getProjectSurface(workspaceId, projectId),
    experienceId,
    subpath,
    title,
  );
  const basePath = getExperiencePath(getProjectSurface(workspaceId, projectId), experienceId);

  const isEnabled = project && definition && isExperienceEnabled(definition, project.capabilities);
  const pageError = error ?? catalogError;

  return (
    <PageShell.Content className="max-w-7xl">
      <PageShell.Header title={title ?? "Experience"} />
      <BackLink href={backLink.to} label={backLink.label} />
      {definition && (
        <p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          {definition.description}
        </p>
      )}

      {isLoading || isCatalogLoading ? (
        <ContentLoadingSkeleton />
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
            <ButtonLink
              variant="primary"
              href={`/work/${workspaceId}/projects/${projectId}/library`}
            >
              Manage capabilities
            </ButtonLink>
          }
        />
      ) : (
        <ExperienceRenderer
          basePath={basePath}
          projectBasePath={getProjectSurface(workspaceId, projectId).basePath}
          projectId={projectId}
          repository={project.codingEnvironment?.repository ?? null}
          runtime={definition.runtime}
          subpath={subpath}
        />
      )}
    </PageShell.Content>
  );
}
