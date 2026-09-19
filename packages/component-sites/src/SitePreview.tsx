import { cn } from "@ngriffin_uk/polychat-component-ui";
import { listSitePages, type SiteProject } from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { SiteFrame } from "./SiteFrame.js";

export const SITE_PREVIEW_VIEWPORTS = {
  desktop: { label: "Desktop", width: "100%" },
  tablet: { label: "Tablet", width: "768px" },
  mobile: { label: "Mobile", width: "390px" },
} as const;

export type SitePreviewViewport = keyof typeof SITE_PREVIEW_VIEWPORTS;

export interface SitePreviewProps {
  project: SiteProject;
  pageId?: string;
  viewport?: SitePreviewViewport;
  onNavigate?: (pageId: string) => void;
  inspecting?: boolean;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  className?: string;
}

export function resolveSitePageId(project: SiteProject, pageId?: string): string | null {
  if (pageId && pageId in project.pages) {
    return pageId;
  }

  return listSitePages(project)[0]?.id ?? null;
}

export function findSitePageIdByPath(project: SiteProject, path: string): string | null {
  const normalised = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const match = listSitePages(project).find(({ page }) => page.path === normalised);

  return match?.id ?? null;
}

export function SitePreview({
  project,
  pageId,
  viewport = "desktop",
  onNavigate,
  inspecting = false,
  selectedKey = null,
  onSelect,
  className,
}: SitePreviewProps) {
  const resolvedPageId = resolveSitePageId(project, pageId);
  const payload = useMemo(
    () => ({ project, pageId: resolvedPageId, inspecting, selectedKey }),
    [inspecting, project, resolvedPageId, selectedKey],
  );
  const handleNavigate = (path: string) => {
    const target = findSitePageIdByPath(project, path);

    if (target && onNavigate) {
      onNavigate(target);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full justify-center overflow-hidden bg-muted/40",
        viewport !== "desktop" && "p-4",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-full min-h-0 justify-center transition-[width] duration-300",
          viewport !== "desktop" && "overflow-hidden rounded-xl border shadow-lg",
        )}
        style={{ width: SITE_PREVIEW_VIEWPORTS[viewport].width, maxWidth: "100%" }}
      >
        <SiteFrame
          payload={payload}
          width="100%"
          title={`${project.title} preview`}
          onNavigate={handleNavigate}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
