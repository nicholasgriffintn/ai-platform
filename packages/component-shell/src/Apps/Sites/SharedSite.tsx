import { resolveSitePageId, SitePreview } from "@ngriffin_uk/polychat-component-sites";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import {
  applySitePatch,
  buildSiteImageRewritePatches,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import {
  listSitePages,
  SITE_OUTPUT_KIND,
  siteProjectSchema,
  type SharedOutput,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

const PRIVATE_OUTPUT_PATTERN = /\/outputs\/([^/]+)\/content$/;

export function readSharedSiteProject(output: SharedOutput, token: string): SiteProject | null {
  if (output.kind !== SITE_OUTPUT_KIND || !isRecord(output.content)) {
    return null;
  }

  const parsed = siteProjectSchema.safeParse(output.content.project);

  if (!parsed.success) {
    return null;
  }

  const document = structuredClone(parsed.data) as unknown as Record<string, unknown>;

  for (const patch of buildSiteImageRewritePatches(parsed.data, (src) => {
    const match = PRIVATE_OUTPUT_PATTERN.exec(src);

    return match
      ? `${API_BASE_URL}/sites/shared/${encodeURIComponent(token)}/images/${encodeURIComponent(match[1])}`
      : null;
  })) {
    applySitePatch(document, patch);
  }

  return validateSiteProject(document).project;
}

export function SharedSite({ project }: { project: SiteProject }) {
  const [pageId, setPageId] = useState<string | null>(null);
  const pages = listSitePages(project);
  const activePageId = resolveSitePageId(project, pageId ?? undefined);

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="truncate font-display text-sm font-semibold">{project.title}</span>
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
        <span className="text-xs text-muted-foreground">Built with Polychat Sites</span>
      </div>
      <div className="min-h-0 flex-1">
        <SitePreview
          project={project}
          pageId={activePageId ?? undefined}
          onNavigate={setPageId}
          className="bg-background"
        />
      </div>
    </div>
  );
}
