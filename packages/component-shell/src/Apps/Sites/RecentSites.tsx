import { Badge, CardGridLoadingSkeleton, cn, Link } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { useSites } from "@ngriffin_uk/polychat-library-react";
import type { SiteSummary } from "@ngriffin_uk/polychat-schemas";

export interface RecentSitesProps {
  basePath: string;
  projectId?: string;
  className?: string;
}

export function RecentSites({ basePath, projectId, className }: RecentSitesProps) {
  const { data: sites, isLoading, error } = useSites(projectId);

  if (isLoading) {
    return <CardGridLoadingSkeleton count={3} label="Loading recent sites" />;
  }

  if (isAuthenticationError(error) || error || !sites?.length) {
    return null;
  }

  return (
    <section className={cn("flex w-full flex-col gap-3", className)}>
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recent</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <li key={site.id}>
            <SiteCard site={site} href={`${basePath}/${site.id}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SiteCard({ site, href }: { site: SiteSummary; href: string }) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 no-underline transition-all duration-200 hover:border-border-strong hover:!no-underline hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-display text-sm font-semibold text-foreground group-hover:underline">
          {site.title}
        </span>
        <Badge variant="secondary">{site.kind}</Badge>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground no-underline">{site.brief}</p>
      <span className="mt-auto text-xs text-muted-foreground no-underline">
        {site.pageCount} {site.pageCount === 1 ? "page" : "pages"} · revision {site.revision}
      </span>
    </Link>
  );
}
