import { resolveSitePageId, SitePreview } from "@ngriffin_uk/polychat-component-sites";
import { Badge, ButtonLink, cn } from "@ngriffin_uk/polychat-component-ui";
import { getAppPath, getSurfaceFromPathname } from "@ngriffin_uk/polychat-library-react";
import { listSitePages, siteProjectSchema, type SiteProject } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";

interface SiteMessageData {
  siteId: string;
  title: string;
  project: SiteProject;
  kind?: string;
}

function readSiteMessageData(data: unknown): SiteMessageData | null {
  if (!isRecord(data) || typeof data.siteId !== "string") {
    return null;
  }

  const project = siteProjectSchema.safeParse(data.project);

  if (!project.success) {
    return null;
  }

  return {
    siteId: data.siteId,
    title: typeof data.title === "string" ? data.title : project.data.title,
    project: project.data,
    kind: isRecord(data.plan) && typeof data.plan.kind === "string" ? data.plan.kind : undefined,
  };
}

export function SiteMessageView({ data, embedded }: { data: unknown; embedded?: boolean }) {
  const location = useLocation();
  const [pageId, setPageId] = useState<string | null>(null);
  const site = readSiteMessageData(data);

  if (!site) {
    return null;
  }

  const pages = listSitePages(site.project);
  const activePageId = resolveSitePageId(site.project, pageId ?? undefined);
  const studioPath = getAppPath(getSurfaceFromPathname(location.pathname), "sites", site.siteId);

  return (
    <div className="my-2 flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="truncate font-display text-sm font-semibold">{site.title}</span>
        {site.kind && <Badge variant="secondary">{site.kind}</Badge>}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {pages.length > 1 &&
            pages.map(({ id, page }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPageId(id)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs transition-colors",
                  id === activePageId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {page.title}
              </button>
            ))}
        </div>
        <ButtonLink href={studioPath} variant="outline" size="sm" icon={<ExternalLink size={14} />}>
          Open in Sites
        </ButtonLink>
      </div>
      <div className={cn("w-full", embedded ? "h-72" : "h-[32rem]")}>
        <SitePreview
          project={site.project}
          pageId={activePageId ?? undefined}
          onNavigate={setPageId}
        />
      </div>
    </div>
  );
}
