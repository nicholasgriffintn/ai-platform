import {
  resolveSitePageId,
  SITE_PREVIEW_VIEWPORTS,
  SiteCodeView,
  SitePreview,
  type SitePreviewViewport,
} from "@ngriffin_uk/polychat-component-sites";
import {
  BackLink,
  Badge,
  Button,
  cn,
  ConfirmationDialog,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useBuildSite,
  useDeleteSite,
  useCreateOutputShare,
  useOpenSitePullRequest,
  useProject,
  useSiteGeneration,
  SITES_QUERY_KEYS,
  type SiteGenerationState,
} from "@ngriffin_uk/polychat-library-react";
import {
  buildSiteRepairPrompt,
  collectEmptySiteImageSlots,
  generateSiteFiles,
} from "@ngriffin_uk/polychat-library-sites";
import { listSitePages, type SiteQuality, type SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import {
  Code2,
  Eye,
  GitPullRequest,
  Hammer,
  History,
  ImagePlus,
  LayoutTemplate,
  Monitor,
  MousePointerSquareDashed,
  Share2,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useOwnAppChrome } from "../AppChrome.js";
import { RecentSites } from "./RecentSites.js";
import { SiteHistory, type SiteRevisionPreview } from "./SiteHistory.js";
import { SiteInspector } from "./SiteInspector.js";
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
  const { state, generate, edit, generateImages, load, cancel } = useSiteGeneration({
    projectId,
    initialSite: site,
  });
  const deleteSite = useDeleteSite(projectId);
  const buildSite = useBuildSite();
  const openPullRequest = useOpenSitePullRequest();
  const { data: workProject } = useProject(projectId);
  const [pullRequestOpen, setPullRequestOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisionPreview, setRevisionPreview] = useState<SiteRevisionPreview | null>(null);
  const createShare = useCreateOutputShare();
  const queryClient = useQueryClient();
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<SitePreviewViewport>("desktop");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [inspecting, setInspecting] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const project = revisionPreview?.project ?? state.project;
  const pages = useMemo(() => (project ? listSitePages(project) : []), [project]);
  const resolvedPageId = project ? resolveSitePageId(project, activePageId ?? undefined) : null;
  const activePage = project && resolvedPageId ? project.pages[resolvedPageId] : null;
  const selectedElement =
    selectedKey && activePage?.elements[selectedKey] ? activePage.elements[selectedKey] : null;
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

  const loadedRevision = state.site?.revision;

  useEffect(() => {
    if (site && loadedRevision !== undefined && site.revision > loadedRevision && !isBusy) {
      load(site);
    }
  }, [isBusy, load, loadedRevision, site]);

  const handleRestored = () => {
    setHistoryOpen(false);
    void queryClient.invalidateQueries({
      queryKey: SITES_QUERY_KEYS.detail(projectId, state.site?.id),
    });
  };

  const handleShare = async () => {
    if (!state.site) {
      return;
    }

    try {
      const { token } = await createShare.mutateAsync({ outputId: state.site.id });
      const url = `${window.location.origin}/o/${encodeURIComponent(token)}`;

      await navigator.clipboard.writeText(url);
      toast.success("Public preview link copied", {
        action: { label: "Open", onClick: () => window.open(url, "_blank", "noopener") },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The site could not be shared");
    }
  };

  const handleSubmit = (prompt: string) => {
    void generate({
      prompt,
      siteId: state.site?.id,
      ...(state.site && selectedElement && resolvedPageId
        ? { target: { pageId: resolvedPageId, elementKey: selectedKey as string } }
        : {}),
    });
  };

  const handleSelectPage = (pageId: string) => {
    setActivePageId(pageId);
    setSelectedKey(null);
  };

  const handleDelete = async () => {
    if (!state.site) {
      return;
    }

    await deleteSite.mutateAsync(state.site.id);
    toast.success("Site deleted");
    void navigate(basePath);
  };

  const fileCount = useMemo(
    () => (project && pullRequestOpen ? generateSiteFiles(project).files.length : 0),
    [project, pullRequestOpen],
  );
  const repository = workProject?.codingEnvironment?.repository;
  const emptyImageSlots = useMemo(
    () => (project ? collectEmptySiteImageSlots(project).length : 0),
    [project],
  );

  const handlePullRequest = async () => {
    if (!state.site || !projectId) {
      return;
    }

    try {
      const result = await openPullRequest.mutateAsync({
        id: state.site.id,
        request: { projectId },
      });

      toast.success(`Opened pull request #${result.number} on ${result.repo}`, {
        action: { label: "View", onClick: () => window.open(result.url, "_blank", "noopener") },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The pull request could not be opened");
    }
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
            <SitePlanSummary
              plan={state.plan}
              issues={state.issues}
              quality={state.quality}
              model={state.model}
              isRepairing={isBusy}
              onRepair={
                state.site && state.quality
                  ? () =>
                      void generate({
                        prompt: buildSiteRepairPrompt(
                          state.site?.brief ?? "",
                          state.quality as SiteQuality,
                          state.issues,
                        ),
                        siteId: state.site?.id,
                      })
                  : undefined
              }
            />
          )}
          {state.imageStatus === "generating" && (
            <p className="text-xs text-muted-foreground" role="status">
              Generating images for the placeholders
            </p>
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
          {selectedElement && state.site && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">
              <span className="truncate">
                Refining <span className="font-medium">{selectedElement.type}</span>{" "}
                <span className="font-mono text-muted-foreground">{selectedKey}</span>
              </span>
              <button
                type="button"
                className="shrink-0 hover:underline"
                onClick={() => setSelectedKey(null)}
              >
                Whole site
              </button>
            </div>
          )}
          <SitePromptComposer
            placeholder={
              selectedElement && state.site
                ? `Change this ${selectedElement.type}…`
                : state.site
                  ? "Change something…"
                  : "Describe the site…"
            }
            submitLabel={state.site ? "Refine" : "Build"}
            isBusy={isBusy}
            onSubmit={handleSubmit}
            onCancel={cancel}
          />
        </div>
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              {pages.map(({ id, page }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectPage(id)}
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
              {revisionPreview && (
                <Badge variant="outline">Viewing revision {revisionPreview.revision}</Badge>
              )}
              {inspecting && !selectedElement && view === "preview" && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  Click an element to edit or refine it
                </span>
              )}
            </div>
            <SegmentedGroup label="Viewport">
              {(Object.keys(SITE_PREVIEW_VIEWPORTS) as SitePreviewViewport[]).map((key) => {
                const Icon = VIEWPORT_ICONS[key];

                return (
                  <SegmentedButton
                    key={key}
                    active={viewport === key}
                    label={SITE_PREVIEW_VIEWPORTS[key].label}
                    onClick={() => setViewport(key)}
                  >
                    <Icon size={14} />
                  </SegmentedButton>
                );
              })}
            </SegmentedGroup>
            <SegmentedGroup label="View">
              <SegmentedButton
                active={view === "preview" && !inspecting}
                label="Preview"
                onClick={() => {
                  setView("preview");
                  setInspecting(false);
                }}
              >
                <Eye size={14} />
              </SegmentedButton>
              <SegmentedButton
                active={view === "preview" && inspecting}
                label="Select elements to edit"
                onClick={() => {
                  setView("preview");
                  setInspecting(true);
                }}
              >
                <MousePointerSquareDashed size={14} />
              </SegmentedButton>
              <SegmentedButton
                active={view === "code"}
                label="Code"
                onClick={() => {
                  setView("code");
                  setInspecting(false);
                }}
              >
                <Code2 size={14} />
              </SegmentedButton>
            </SegmentedGroup>
          </div>
          {state.site && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={historyOpen ? "secondary" : "outline"}
                size="sm"
                icon={<History size={14} />}
                aria-pressed={historyOpen}
                onClick={() => {
                  setHistoryOpen((current) => !current);
                  setRevisionPreview(null);
                  setSelectedKey(null);
                }}
              >
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Share2 size={14} />}
                onClick={() => void handleShare()}
                isLoading={createShare.isPending}
                title="Copy a public preview link"
              >
                Share
              </Button>
              {emptyImageSlots > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ImagePlus size={14} />}
                  onClick={() => void generateImages()}
                  isLoading={state.imageStatus === "generating"}
                  disabled={isBusy}
                  title="Generate an image for every empty placeholder"
                >
                  Fill images
                </Button>
              )}
              {projectId && (
                <>
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<GitPullRequest size={14} />}
                    onClick={() => setPullRequestOpen(true)}
                    isLoading={openPullRequest.isPending}
                    disabled={isBusy || !repository}
                    title={
                      repository
                        ? `Open a pull request on ${repository}`
                        : "Connect a repository first"
                    }
                  >
                    Open pull request
                  </Button>
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
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1">
          {project ? (
            view === "code" ? (
              <SiteCodeView files={files} className="flex-1" />
            ) : (
              <>
                <SitePreview
                  project={project}
                  pageId={resolvedPageId ?? undefined}
                  viewport={viewport}
                  onNavigate={handleSelectPage}
                  inspecting={inspecting}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  className="flex-1"
                />
                {historyOpen && state.site && (
                  <SiteHistory
                    siteId={state.site.id}
                    currentRevision={state.site.revision}
                    previewRevision={revisionPreview?.revision ?? null}
                    onPreview={setRevisionPreview}
                    onRestored={handleRestored}
                    onClose={() => {
                      setHistoryOpen(false);
                      setRevisionPreview(null);
                    }}
                  />
                )}
                {!historyOpen && selectedElement && activePage && resolvedPageId && (
                  <SiteInspector
                    pageId={resolvedPageId}
                    page={activePage}
                    elementKey={selectedKey as string}
                    onSelect={setSelectedKey}
                    onEdit={edit}
                  />
                )}
              </>
            )
          ) : (
            <div className="flex h-full flex-1 items-center justify-center p-8">
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
      <ConfirmationDialog
        open={pullRequestOpen}
        onOpenChange={setPullRequestOpen}
        title="Open a pull request"
        description={`Commit ${fileCount} generated files to a new branch on ${repository ?? "the project repository"} and open a pull request against its default branch. Nothing is pushed to the default branch itself.`}
        confirmText="Open pull request"
        variant="primary"
        onConfirm={handlePullRequest}
      />
    </div>
  );
}

function SegmentedGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
    >
      {children}
    </div>
  );
}

function SegmentedButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-[5px] transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
