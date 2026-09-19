import {
  resolveSitePageId,
  SITE_PREVIEW_VIEWPORTS,
  SiteCodeView,
  SitePreview,
  type SitePreviewViewport,
} from "@ngriffin_uk/polychat-component-sites";
import { BackLink, Button, cn, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  useBuildSite,
  useDeleteSite,
  useSiteGeneration,
  type SiteGenerationState,
} from "@ngriffin_uk/polychat-library-react";
import { generateSiteFiles } from "@ngriffin_uk/polychat-library-sites";
import { listSitePages, type SiteRecord } from "@ngriffin_uk/polychat-schemas";
import {
  Code2,
  Eye,
  Hammer,
  LayoutTemplate,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useOwnAppChrome } from "../AppChrome.js";
import { RecentSites } from "./RecentSites.js";
import { SitePlanSummary } from "./SitePlanSummary.js";
import { SitePromptComposer } from "./SitePromptComposer.js";

const EXAMPLE_BRIEFS = [
  "A landing page for a bakery in Leeds that takes wedding cake orders",
  "An analytics dashboard for a coffee subscription business",
  "A three-page marketing site for an accountancy firm: home, services, contact",
  "A pricing section with three tiers for a note-taking app",
];

const VIEWPORT_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;

const STATUS_LABELS: Record<SiteGenerationState["status"], string> = {
  idle: "",
  planning: "Jev is reading the brief",
  streaming: "Building",
  saving: "Saving",
  done: "Saved",
  error: "Failed",
};

export interface SiteStudioProps {
  basePath: string;
  projectId?: string;
  site?: SiteRecord | null;
}

export function SiteStudio({ basePath, projectId, site }: SiteStudioProps) {
  const navigate = useNavigate();
  const chrome = useOwnAppChrome(true);
  const { state, generate, cancel } = useSiteGeneration({ projectId, initialSite: site });
  const deleteSite = useDeleteSite(projectId);
  const buildSite = useBuildSite();
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<SitePreviewViewport>("desktop");
  const [view, setView] = useState<"preview" | "code">("preview");
  const project = state.project;
  const pages = useMemo(() => (project ? listSitePages(project) : []), [project]);
  const resolvedPageId = project ? resolveSitePageId(project, activePageId ?? undefined) : null;
  const files = useMemo(
    () => (project && view === "code" ? generateSiteFiles(project).files : []),
    [project, view],
  );
  const isBusy =
    state.status === "planning" || state.status === "streaming" || state.status === "saving";
  const savedId = state.site?.id;

  useEffect(() => {
    if (savedId && !site) {
      void navigate(`${basePath}/${savedId}`, { replace: true });
    }
  }, [basePath, navigate, savedId, site]);

  const handleSubmit = (prompt: string) => {
    void generate({ prompt, siteId: state.site?.id });
  };

  const handleDelete = async () => {
    if (!state.site) {
      return;
    }

    await deleteSite.mutateAsync(state.site.id);
    toast.success("Site deleted");
    void navigate(basePath);
  };

  const handleBuild = async () => {
    if (!state.site || !projectId) {
      return;
    }

    try {
      const result = await buildSite.mutateAsync({ id: state.site.id, request: { projectId } });

      toast.success(`Queued a sandbox build in ${result.repo}`, {
        action: {
          label: "Open activity",
          onClick: () => void navigate(`${basePath.replace(/\/apps\/.*$/, "")}/activity`),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The sandbox build could not start");
    }
  };

  if (!project && !isBusy && state.status !== "error") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-6 pt-4">
          <BackLink href={chrome?.backHref ?? basePath} label={chrome?.backLabel ?? "Back"} />
        </div>
        <div className="flex flex-1 flex-col items-center gap-8 overflow-auto px-6 pt-12 pb-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <LayoutTemplate size={24} />
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              What are we building?
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              One brief. Jev works out what kind of site it is, a coding model writes it, and you
              watch it land section by section.
            </p>
          </div>
          <SitePromptComposer
            size="hero"
            autoFocus
            placeholder="A landing page for…"
            submitLabel="Build"
            isBusy={false}
            onSubmit={handleSubmit}
            className="w-full max-w-2xl"
          />
          <ul className="flex max-w-2xl flex-wrap justify-center gap-2">
            {EXAMPLE_BRIEFS.map((brief) => (
              <li key={brief}>
                <button
                  type="button"
                  onClick={() => handleSubmit(brief)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                >
                  {brief}
                </button>
              </li>
            ))}
          </ul>
          <RecentSites basePath={basePath} projectId={projectId} className="max-w-5xl pt-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-3 px-4 pt-4">
          <BackLink href={chrome?.backHref ?? basePath} label={chrome?.backLabel ?? "Back"} />
          <div className="flex items-start justify-between gap-2">
            <h1 className="truncate font-display text-lg font-semibold" title={project?.title}>
              {project?.title ?? "New site"}
            </h1>
            {state.site && (
              <Button
                variant="icon"
                size="icon"
                aria-label="Delete site"
                icon={<Trash2 size={16} />}
                onClick={() => void handleDelete()}
                isLoading={deleteSite.isPending}
              />
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 py-4">
          {(state.site?.turns ?? []).map((turn) => (
            <div key={turn.id} className="flex flex-col gap-1">
              <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                {turn.prompt}
              </p>
            </div>
          ))}
          {state.plan && (
            <SitePlanSummary plan={state.plan} issues={state.issues} model={state.model} />
          )}
          {state.status !== "idle" && state.status !== "done" && (
            <p
              className={cn(
                "text-xs",
                state.status === "error" ? "text-failure" : "text-muted-foreground",
              )}
              role="status"
            >
              {state.status === "error"
                ? state.error
                : `${STATUS_LABELS[state.status]}${state.patchCount ? ` · ${state.patchCount} updates` : ""}`}
            </p>
          )}
        </div>
        <div className="border-t border-border p-3">
          <SitePromptComposer
            placeholder={state.site ? "Change something…" : "Describe the site…"}
            submitLabel={state.site ? "Refine" : "Build"}
            isBusy={isBusy}
            onSubmit={handleSubmit}
            onCancel={cancel}
          />
        </div>
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {pages.map(({ id, page }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActivePageId(id)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  id === resolvedPageId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {page.title}
                <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                  {page.path}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {(Object.keys(SITE_PREVIEW_VIEWPORTS) as SitePreviewViewport[]).map((key) => {
              const Icon = VIEWPORT_ICONS[key];

              return (
                <Button
                  key={key}
                  variant={viewport === key ? "iconActive" : "icon"}
                  size="icon"
                  aria-label={SITE_PREVIEW_VIEWPORTS[key].label}
                  aria-pressed={viewport === key}
                  icon={<Icon size={14} />}
                  onClick={() => setViewport(key)}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <Button
              variant={view === "preview" ? "iconActive" : "icon"}
              size="icon"
              aria-label="Preview"
              aria-pressed={view === "preview"}
              icon={<Eye size={14} />}
              onClick={() => setView("preview")}
            />
            <Button
              variant={view === "code" ? "iconActive" : "icon"}
              size="icon"
              aria-label="Code"
              aria-pressed={view === "code"}
              icon={<Code2 size={14} />}
              onClick={() => setView("code")}
            />
          </div>
          {projectId && state.site && (
            <Button
              variant="outline"
              size="sm"
              icon={<Hammer size={14} />}
              onClick={() => void handleBuild()}
              isLoading={buildSite.isPending}
              disabled={isBusy}
            >
              Build in sandbox
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {project ? (
            view === "code" ? (
              <SiteCodeView files={files} />
            ) : (
              <SitePreview
                project={project}
                pageId={resolvedPageId ?? undefined}
                viewport={viewport}
                onNavigate={setActivePageId}
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                title={state.status === "error" ? "Nothing to show" : STATUS_LABELS[state.status]}
                message={
                  state.status === "error"
                    ? (state.error ?? "The build failed before anything arrived.")
                    : "The first section lands as soon as the model writes it."
                }
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
