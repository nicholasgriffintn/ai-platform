import type {
  SiteBuildRequest,
  SiteBuildResponse,
  SiteEditRequest,
  SiteExportTarget,
  SiteFilesResponse,
  SiteGenerateRequest,
  SiteImageStreamEvent,
  SiteImagesRequest,
  SiteListResponse,
  SitePullRequestRequest,
  SitePullRequestResponse,
  SiteRecord,
  SiteResponse,
  SiteStreamEvent,
  SiteSummary,
} from "@ngriffin_uk/polychat-schemas";
import { readServerSentEvents } from "@ngriffin_uk/polychat-utility-core";

import { fetchApi, fetchApiOrThrow } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";
import { withProjectScope } from "./project-scope.js";

const SITES_BASE_PATH = "/sites";

export const sitesService = {
  async list(projectId?: string): Promise<SiteSummary[]> {
    const response = await fetchApiOrThrow(withProjectScope(SITES_BASE_PATH, projectId), {
      method: "GET",
    });
    const payload = await returnFetchedData<SiteListResponse>(response);

    return payload.sites;
  },

  async get(id: string, projectId?: string): Promise<SiteRecord> {
    const response = await fetchApiOrThrow(
      withProjectScope(`${SITES_BASE_PATH}/${id}`, projectId),
      {
        method: "GET",
      },
    );
    const payload = await returnFetchedData<SiteResponse>(response);

    return payload.site;
  },

  async delete(id: string, projectId?: string): Promise<void> {
    await fetchApiOrThrow(withProjectScope(`${SITES_BASE_PATH}/${id}`, projectId), {
      method: "DELETE",
    });
  },

  async files(
    id: string,
    projectId?: string,
    target?: SiteExportTarget,
  ): Promise<SiteFilesResponse> {
    const path = target
      ? `${SITES_BASE_PATH}/${id}/files?target=${encodeURIComponent(target)}`
      : `${SITES_BASE_PATH}/${id}/files`;
    const response = await fetchApiOrThrow(withProjectScope(path, projectId), { method: "GET" });

    return returnFetchedData<SiteFilesResponse>(response);
  },

  async edit(id: string, request: SiteEditRequest): Promise<SiteRecord> {
    const response = await fetchApiOrThrow(`${SITES_BASE_PATH}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: request,
    });
    const payload = await returnFetchedData<SiteResponse>(response);

    return payload.site;
  },

  async build(id: string, request: SiteBuildRequest): Promise<SiteBuildResponse> {
    const response = await fetchApiOrThrow(`${SITES_BASE_PATH}/${id}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request,
      timeoutMs: null,
    });

    return returnFetchedData<SiteBuildResponse>(response);
  },

  async images(
    id: string,
    request: SiteImagesRequest,
    onEvent: (event: SiteImageStreamEvent) => void,
  ): Promise<void> {
    const response = await fetchApi(`${SITES_BASE_PATH}/${id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: request,
      timeoutMs: null,
    });

    if (!response.ok || !response.body) {
      throw await createApiErrorFromResponse(response, "Failed to generate site images");
    }

    await readServerSentEvents<SiteImageStreamEvent>(response.body, { onEvent });
  },

  async pullRequest(id: string, request: SitePullRequestRequest): Promise<SitePullRequestResponse> {
    const response = await fetchApiOrThrow(`${SITES_BASE_PATH}/${id}/pull-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request,
      timeoutMs: null,
    });

    return returnFetchedData<SitePullRequestResponse>(response);
  },

  async generate(
    request: SiteGenerateRequest,
    onEvent: (event: SiteStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetchApi(`${SITES_BASE_PATH}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: request,
      timeoutMs: null,
      signal,
    });

    if (!response.ok || !response.body) {
      throw await createApiErrorFromResponse(response, "Failed to generate the site");
    }

    await readServerSentEvents<SiteStreamEvent>(response.body, { onEvent });
  },
};
