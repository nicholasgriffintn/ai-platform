import { CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { useSite } from "@ngriffin_uk/polychat-library-react";

import { SignInEmptyState } from "../../Account/SignInEmptyState.js";
import { SiteStudio } from "./SiteStudio.js";

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}

export function SitesApp({ basePath, projectId, subpath }: ExperienceProps) {
  const firstSegment = subpath.split("/").find(Boolean);
  const siteId = firstSegment && firstSegment !== "new" ? firstSegment : undefined;

  if (siteId) {
    return <SiteStudioRoute basePath={basePath} projectId={projectId} siteId={siteId} />;
  }

  return <SiteStudio basePath={basePath} projectId={projectId} />;
}

function SiteStudioRoute({
  basePath,
  projectId,
  siteId,
}: {
  basePath: string;
  projectId?: string;
  siteId: string;
}) {
  const { data: site, isLoading, error } = useSite(siteId, projectId);

  if (isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading site" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState title="Sign in to open this site" message="Sign in to open this site." />
    );
  }

  if (error || !site) {
    return <EmptyState title="Site unavailable" message={error?.message ?? "Site not found"} />;
  }

  return <SiteStudio key={site.id} basePath={basePath} projectId={projectId} site={site} />;
}
