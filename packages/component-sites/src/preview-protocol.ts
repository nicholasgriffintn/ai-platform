import type { SiteProject } from "@ngriffin_uk/polychat-schemas";

export const SITE_PREVIEW_CHANNEL = "polychat-site-preview";

export interface SitePreviewRenderPayload {
  project: SiteProject;
  pageId: string | null;
  inspecting: boolean;
  selectedKey: string | null;
}

export interface SitePreviewRenderMessage {
  channel: typeof SITE_PREVIEW_CHANNEL;
  type: "render";
  frameId: string;
  payload: SitePreviewRenderPayload;
}

export interface SitePreviewReadyMessage {
  channel: typeof SITE_PREVIEW_CHANNEL;
  type: "ready";
  frameId: string;
}

export interface SitePreviewNavigateMessage {
  channel: typeof SITE_PREVIEW_CHANNEL;
  type: "navigate";
  frameId: string;
  path: string;
}

export interface SitePreviewSelectMessage {
  channel: typeof SITE_PREVIEW_CHANNEL;
  type: "select";
  frameId: string;
  key: string | null;
}

export type SitePreviewRuntimeMessage =
  | SitePreviewReadyMessage
  | SitePreviewNavigateMessage
  | SitePreviewSelectMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSitePreviewRenderMessage(value: unknown): value is SitePreviewRenderMessage {
  return (
    isRecord(value) &&
    value.channel === SITE_PREVIEW_CHANNEL &&
    value.type === "render" &&
    typeof value.frameId === "string" &&
    isRecord(value.payload) &&
    isRecord(value.payload.project)
  );
}

export function isSitePreviewRuntimeMessage(value: unknown): value is SitePreviewRuntimeMessage {
  if (
    !isRecord(value) ||
    value.channel !== SITE_PREVIEW_CHANNEL ||
    typeof value.frameId !== "string"
  ) {
    return false;
  }

  if (value.type === "ready") {
    return true;
  }

  if (value.type === "navigate") {
    return typeof value.path === "string";
  }

  return value.type === "select" && (typeof value.key === "string" || value.key === null);
}
