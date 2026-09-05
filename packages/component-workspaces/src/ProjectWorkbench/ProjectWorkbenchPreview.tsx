import { Button, EmptyState, FormSelect, Textarea, cn } from "@ngriffin_uk/polychat-component-ui";
import type { SandboxPreviewAccess, SandboxPreviewState } from "@ngriffin_uk/polychat-schemas";
import {
  ExternalLink,
  Focus,
  Laptop,
  Maximize2,
  Monitor,
  MonitorPlay,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Square,
  Tablet,
} from "lucide-react";
import { useState } from "react";

import type { ProjectWorkbenchServiceItem } from "./ProjectWorkbenchServices";
import {
  type ProjectWorkbenchPreviewRegion,
  usePreviewRegionSelection,
} from "./usePreviewRegionSelection";

export type ProjectWorkbenchPreviewDisplayState = SandboxPreviewState | "loading";

export interface ProjectWorkbenchPreviewViewport {
  id: "fit" | "mobile" | "tablet" | "desktop";
  label: string;
  width?: number;
  height: number;
}

export interface ProjectWorkbenchPreviewFeedback {
  annotation: string;
  elementReference?: string;
  region?: ProjectWorkbenchPreviewRegion;
  route: string;
  serviceName: string;
  viewport: ProjectWorkbenchPreviewViewport;
}

export interface ProjectWorkbenchPreviewProps {
  services: ProjectWorkbenchServiceItem[];
  selectedServiceName?: string;
  preview?: SandboxPreviewAccess;
  state: ProjectWorkbenchPreviewDisplayState;
  canCreate: boolean;
  canSubmitFeedback: boolean;
  disabledReason?: string;
  feedbackDisabledReason?: string;
  isCreating?: boolean;
  isRevoking?: boolean;
  isSubmittingFeedback?: boolean;
  errorMessage?: string;
  onSelectedServiceChange: (serviceName: string) => void;
  onCreate: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenExternal: () => Promise<string>;
  onRevoke: () => Promise<void>;
  onSubmitFeedback: (feedback: ProjectWorkbenchPreviewFeedback) => Promise<void>;
}

const FIT_VIEWPORT: ProjectWorkbenchPreviewViewport = { id: "fit", label: "Fit", height: 620 };

const VIEWPORTS: ProjectWorkbenchPreviewViewport[] = [
  FIT_VIEWPORT,
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "desktop", label: "Desktop", width: 1280, height: 800 },
];

const VIEWPORT_ICONS = {
  fit: Maximize2,
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
} as const;

const STATE_PRESENTATION: Record<
  ProjectWorkbenchPreviewDisplayState,
  { label: string; detail: string; tone: string; animated: boolean }
> = {
  loading: {
    label: "Loading preview",
    detail: "Restoring preview authority and service health.",
    tone: "bg-active-work",
    animated: true,
  },
  starting: {
    label: "Service starting",
    detail: "Preview access will become available when its declared health check passes.",
    tone: "bg-active-work",
    animated: true,
  },
  healthy: {
    label: "Preview healthy",
    detail: "Content is running through short-lived, project-authorised access.",
    tone: "bg-success",
    animated: false,
  },
  unhealthy: {
    label: "Service unhealthy",
    detail: "The declared health check is not passing. Review Activity before retrying.",
    tone: "bg-attention",
    animated: false,
  },
  expired: {
    label: "Preview expired",
    detail: "This access ended. Refresh to create a new short-lived preview.",
    tone: "bg-attention",
    animated: false,
  },
  stopped: {
    label: "Preview stopped",
    detail: "Start the declared service before creating new preview access.",
    tone: "bg-muted-foreground",
    animated: false,
  },
};

interface PreviewRouteState {
  previewId: string;
  activeRoute: string;
  draftRoute: string;
  frameUrl: string;
}

function normaliseRoute(route: string, previewOrigin: string): string | null {
  try {
    const parsed = new URL(route.trim() || "/", previewOrigin);

    if (parsed.origin !== previewOrigin) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function statusAllowsFrame(
  state: ProjectWorkbenchPreviewDisplayState,
  preview?: SandboxPreviewAccess,
): preview is SandboxPreviewAccess & { url: string } {
  return state === "healthy" && Boolean(preview?.url);
}

function selectionStyle(region: ProjectWorkbenchPreviewRegion) {
  return {
    left: `${region.x}%`,
    top: `${region.y}%`,
    width: `${region.width}%`,
    height: `${region.height}%`,
  };
}

function PreviewStateMessage({
  state,
  canCreate,
  disabledReason,
  isCreating,
  onCreate,
}: Pick<
  ProjectWorkbenchPreviewProps,
  "state" | "canCreate" | "disabledReason" | "isCreating" | "onCreate"
>) {
  const presentation = STATE_PRESENTATION[state];

  return (
    <EmptyState
      icon={<MonitorPlay className="text-muted-foreground size-5" />}
      title={presentation.label}
      message={disabledReason ?? presentation.detail}
      className="min-h-72 rounded-none border-0 bg-transparent"
      action={
        canCreate ? (
          <Button type="button" onClick={() => void onCreate()} isLoading={isCreating}>
            Start preview
          </Button>
        ) : undefined
      }
    />
  );
}

function PreviewStatus({ state }: { state: ProjectWorkbenchPreviewDisplayState }) {
  const presentation = STATE_PRESENTATION[state];

  return (
    <output aria-live="polite" className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          presentation.tone,
          presentation.animated && "polychat-motion-active-execution",
        )}
      />
      <span className="truncate text-xs font-medium">{presentation.label}</span>
    </output>
  );
}

function PreviewFrame({
  preview,
  serviceName,
  viewport,
  frameUrl,
  region,
  draftRegion,
  isSelecting,
  overlayProps,
}: {
  preview: SandboxPreviewAccess & { url: string };
  serviceName: string;
  viewport: ProjectWorkbenchPreviewViewport;
  frameUrl: string;
  region?: ProjectWorkbenchPreviewRegion;
  draftRegion?: ProjectWorkbenchPreviewRegion;
  isSelecting: boolean;
  overlayProps: ReturnType<typeof usePreviewRegionSelection>["overlayProps"];
}) {
  const visibleRegion = draftRegion ?? region;

  return (
    <div className="bg-canvas min-h-0 overflow-auto p-3">
      <div
        className="border-border-strong bg-surface relative mx-auto shrink-0 border"
        style={{ width: viewport.width ? `${viewport.width}px` : "100%", height: viewport.height }}
      >
        <iframe
          key={`${preview.previewId}:${frameUrl}`}
          src={frameUrl}
          title={`${serviceName} preview content`}
          className="size-full border-0 bg-surface"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts"
          allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
          referrerPolicy="no-referrer"
        />
        {visibleRegion ? (
          <div
            aria-hidden="true"
            className="border-active-work bg-active-work/10 pointer-events-none absolute border-2"
            style={selectionStyle(visibleRegion)}
          />
        ) : null}
        {isSelecting ? (
          <div
            {...overlayProps}
            aria-label="Drag over the preview to mark a feedback region"
            className="bg-active-work/5 absolute inset-0 cursor-crosshair touch-none"
          />
        ) : null}
      </div>
    </div>
  );
}

export function ProjectWorkbenchPreview({
  services,
  selectedServiceName,
  preview,
  state,
  canCreate,
  canSubmitFeedback,
  disabledReason,
  feedbackDisabledReason,
  isCreating = false,
  isRevoking = false,
  isSubmittingFeedback = false,
  errorMessage,
  onSelectedServiceChange,
  onCreate,
  onRefresh,
  onOpenExternal,
  onRevoke,
  onSubmitFeedback,
}: ProjectWorkbenchPreviewProps) {
  const [viewportId, setViewportId] = useState<ProjectWorkbenchPreviewViewport["id"]>("fit");
  const [routeState, setRouteState] = useState<PreviewRouteState>();
  const [annotation, setAnnotation] = useState("");
  const [elementReference, setElementReference] = useState("");
  const [localError, setLocalError] = useState<string>();
  const regionSelection = usePreviewRegionSelection();
  const viewport = VIEWPORTS.find((candidate) => candidate.id === viewportId) ?? FIT_VIEWPORT;
  const service = services.find((candidate) => candidate.name === selectedServiceName);
  const activeRouteState =
    preview && routeState?.previewId === preview.previewId
      ? routeState
      : preview?.url
        ? {
            previewId: preview.previewId,
            activeRoute: "/",
            draftRoute: "/",
            frameUrl: preview.url,
          }
        : undefined;
  const activePreview = statusAllowsFrame(state, preview) ? preview : undefined;
  const busy = isCreating || isRevoking;

  const runAction = async (action: () => Promise<void>) => {
    setLocalError(undefined);

    try {
      await action();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Preview action failed");
    }
  };

  const navigatePreview = () => {
    if (!preview?.url || !activeRouteState) {
      return;
    }

    const previewOrigin = new URL(preview.url).origin;
    const route = normaliseRoute(activeRouteState.draftRoute, previewOrigin);

    if (!route) {
      setLocalError("Enter a path on this preview origin, such as /settings.");

      return;
    }

    setLocalError(undefined);
    regionSelection.clear();
    setRouteState({
      previewId: preview.previewId,
      activeRoute: route,
      draftRoute: route,
      frameUrl: new URL(route, previewOrigin).toString(),
    });
  };

  const openExternal = async () => {
    const opened = window.open("about:blank", "_blank");

    if (!opened) {
      setLocalError("Allow pop-ups for Polychat to open the preview in a new tab.");

      return;
    }

    opened.opener = null;
    setLocalError(undefined);

    try {
      opened.location.replace(await onOpenExternal());
    } catch (error) {
      opened.close();
      setLocalError(error instanceof Error ? error.message : "Preview could not be opened");
    }
  };

  const submitFeedback = async () => {
    const feedback = annotation.trim();

    if (!feedback || !selectedServiceName || !activeRouteState) {
      return;
    }

    setLocalError(undefined);

    try {
      await onSubmitFeedback({
        annotation: feedback,
        elementReference: elementReference.trim() || undefined,
        region: regionSelection.region,
        route: activeRouteState.activeRoute,
        serviceName: selectedServiceName,
        viewport,
      });
      setAnnotation("");
      setElementReference("");
      regionSelection.clear();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Feedback could not be sent");
    }
  };

  return (
    <section aria-label="Service preview" className="@container flex min-h-full flex-col gap-3">
      <div className="bg-surface-elevated border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="text-success size-4 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium">Trusted review controls</span>
        </div>
        <div className="ml-auto">
          <PreviewStatus state={state} />
        </div>
      </div>

      <div className="space-y-3 px-1">
        {services.length > 1 ? (
          <FormSelect
            label="Declared service"
            value={selectedServiceName ?? ""}
            onChange={(event) => {
              regionSelection.clear();
              onSelectedServiceChange(event.target.value);
            }}
            options={services.map((candidate) => ({
              value: candidate.name,
              label: `${candidate.name} · ${candidate.status.replaceAll("_", " ")}${candidate.expectedPort ? ` · ${candidate.expectedPort}` : ""}`,
            }))}
          />
        ) : service ? (
          <div className="flex items-center gap-2 text-sm">
            <Laptop className="text-creative size-4" aria-hidden="true" />
            <span className="font-mono font-medium">{service.name}</span>
            {service.expectedPort ? (
              <span className="text-muted-foreground text-xs">Port {service.expectedPort}</span>
            ) : null}
          </div>
        ) : null}

        {activePreview && activeRouteState ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <form
                className="min-w-48 flex-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  navigatePreview();
                }}
              >
                <label className="text-muted-foreground text-xs" htmlFor="preview-route">
                  Recorded route
                </label>
                <div className="mt-1 flex gap-1">
                  <input
                    id="preview-route"
                    value={activeRouteState.draftRoute}
                    onChange={(event) =>
                      setRouteState({ ...activeRouteState, draftRoute: event.target.value })
                    }
                    maxLength={500}
                    spellCheck={false}
                    className="border-input bg-surface text-foreground focus:border-ring focus:ring-ring/30 min-h-9 min-w-0 flex-1 border px-3 font-mono text-xs outline-none focus:ring-[3px]"
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Go
                  </Button>
                </div>
              </form>
              <fieldset className="m-0 border-0 p-0">
                <legend className="text-muted-foreground text-xs">Viewport</legend>
                <div className="mt-1 flex gap-1">
                  {VIEWPORTS.map((candidate) => {
                    const Icon = VIEWPORT_ICONS[candidate.id];

                    return (
                      <Button
                        key={candidate.id}
                        type="button"
                        variant={viewport.id === candidate.id ? "iconActive" : "icon"}
                        size="icon"
                        title={`${candidate.label}${candidate.width ? ` ${candidate.width} pixels` : " viewport"}`}
                        aria-label={`${candidate.label} viewport`}
                        aria-pressed={viewport.id === candidate.id}
                        onClick={() => {
                          regionSelection.clear();
                          setViewportId(candidate.id);
                        }}
                      >
                        <Icon className="size-4" />
                      </Button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="border-border bg-surface overflow-hidden border">
              <div className="border-border flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
                <span className="text-muted-foreground text-xs">Untrusted preview content</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {viewport.width ? `${viewport.width} × ${viewport.height}` : "Fit to panel"}
                </span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant={regionSelection.isSelecting ? "iconActive" : "ghost"}
                    size="xs"
                    icon={<Focus className="size-3.5" />}
                    onClick={
                      regionSelection.isSelecting
                        ? regionSelection.cancelSelecting
                        : regionSelection.startSelecting
                    }
                  >
                    {regionSelection.isSelecting ? "Cancel region" : "Mark region"}
                  </Button>
                  {regionSelection.region ? (
                    <Button type="button" variant="ghost" size="xs" onClick={regionSelection.clear}>
                      Clear region
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    icon={<ExternalLink className="size-3.5" />}
                    disabled={busy}
                    onClick={() => void openExternal()}
                  >
                    Open externally
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    icon={<RefreshCw className="size-3.5" />}
                    disabled={!canCreate || busy}
                    onClick={() =>
                      void runAction(async () => {
                        regionSelection.clear();
                        await onRefresh();
                      })
                    }
                  >
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    icon={<Square className="size-3.5" />}
                    disabled={busy}
                    onClick={() =>
                      void runAction(async () => {
                        regionSelection.clear();
                        await onRevoke();
                      })
                    }
                  >
                    End
                  </Button>
                </div>
              </div>
              <PreviewFrame
                preview={activePreview}
                serviceName={selectedServiceName ?? activePreview.serviceName}
                viewport={viewport}
                frameUrl={activeRouteState.frameUrl}
                region={regionSelection.region}
                draftRegion={regionSelection.draft}
                isSelecting={regionSelection.isSelecting}
                overlayProps={regionSelection.overlayProps}
              />
            </div>

            <div className="border-border bg-surface-elevated border p-3">
              <div className="flex items-start gap-2">
                <Focus className="text-creative mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-medium">Send review feedback</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Route, viewport and any marked region are attached to an attributable run
                    instruction. Preview content cannot submit it.
                  </p>
                </div>
              </div>
              <label className="text-muted-foreground mt-3 block text-xs" htmlFor="preview-target">
                Element reference <span className="font-normal">(optional)</span>
              </label>
              <input
                id="preview-target"
                value={elementReference}
                onChange={(event) => setElementReference(event.target.value)}
                maxLength={160}
                placeholder="For example: Save button in the account form"
                disabled={!canSubmitFeedback}
                className="border-input bg-surface text-foreground focus:border-ring focus:ring-ring/30 mt-1 min-h-9 w-full border px-3 text-sm outline-none focus:ring-[3px] disabled:opacity-60"
              />
              <label
                className="text-muted-foreground mt-3 block text-xs"
                htmlFor="preview-feedback"
              >
                Feedback
              </label>
              <Textarea
                id="preview-feedback"
                value={annotation}
                onChange={(event) => setAnnotation(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Describe what should change and what good looks like."
                disabled={!canSubmitFeedback}
                className="mt-1 rounded-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSubmitFeedback || !annotation.trim()}
                  isLoading={isSubmittingFeedback}
                  onClick={() => void submitFeedback()}
                >
                  Send instruction
                </Button>
                <span className="text-muted-foreground text-xs">
                  {activeRouteState.activeRoute} · {viewport.label}
                  {regionSelection.region ? " · Region marked" : ""}
                </span>
              </div>
              {!canSubmitFeedback && feedbackDisabledReason ? (
                <p className="text-attention mt-2 text-xs">{feedbackDisabledReason}</p>
              ) : null}
            </div>
          </>
        ) : (
          <PreviewStateMessage
            state={state}
            canCreate={canCreate}
            disabledReason={disabledReason}
            isCreating={isCreating}
            onCreate={onCreate}
          />
        )}

        {errorMessage || localError ? (
          <p role="alert" className="text-failure px-1 text-xs">
            {localError ?? errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
