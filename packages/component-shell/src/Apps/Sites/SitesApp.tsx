import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { useSite } from "@ngriffin_uk/polychat-library-react";
import type { AppSurfaceDefinition } from "@ngriffin_uk/polychat-schemas";

import { SignInEmptyState } from "../../Account/SignInEmptyState.js";
import { PageShell } from "../../Shell/PageShell.js";
import { AppSurfaceLoading } from "../AppSurface.js";
import { SiteStudio } from "./SiteStudio.js";

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
  presentation: AppSurfaceDefinition;
}

export function SitesApp({ basePath, projectId, subpath, presentation }: ExperienceProps) {
  const firstSegment = subpath.split("/").find(Boolean);
  const siteId = firstSegment && firstSegment !== "new" ? firstSegment : undefined;

  if (siteId) {
    return (
      <SiteStudioRoute
        basePath={basePath}
        projectId={projectId}
        siteId={siteId}
        presentation={presentation}
      />
    );
  }

  return <SiteStudio basePath={basePath} projectId={projectId} />;
}

function SiteStudioRoute({
  basePath,
  projectId,
  siteId,
  presentation,
}: {
  basePath: string;
  projectId?: string;
  siteId: string;
  presentation: AppSurfaceDefinition;
}) {
  const { data: site, isLoading, error } = useSite(siteId, projectId);

  if (isLoading) {
    return <AppSurfaceLoading label="Loading site" presentation={presentation} />;
  }

  if (isAuthenticationError(error)) {
    return (
      <PageShell.Content className="max-w-6xl">
        <SignInEmptyState title="Sign in to open this site" message="Sign in to open this site." />
      </PageShell.Content>
    );
  }

  if (error || !site) {
    return (
      <PageShell.Content className="max-w-6xl">
        <EmptyState title="Site unavailable" message={error?.message ?? "Site not found"} />
      </PageShell.Content>
    );
  }

  return <SiteStudio key={site.id} basePath={basePath} projectId={projectId} site={site} />;
}
