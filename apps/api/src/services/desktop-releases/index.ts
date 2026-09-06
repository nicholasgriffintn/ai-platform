import type {
  DesktopDownloads,
  DesktopUpdate,
  DesktopUpdateArchitecture,
  DesktopUpdateTarget,
} from "@ngriffin_uk/polychat-schemas";
import { isNewerVersion } from "@ngriffin_uk/polychat-utility-core";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  findArchive,
  findBundle,
  findUpdateBundle,
  findUpdaterArtifact,
  listDesktopDownloads,
  type DesktopBundle,
  type DesktopRelease,
  type DesktopReleaseAsset,
} from "./assets";
import { fetchLatestDesktopRelease, fetchReleaseAsset } from "./github";

const DEFAULT_API_BASE_URL = "https://api.polychat.app";

export interface DesktopUpdateRequest {
  target: DesktopUpdateTarget;
  architecture: DesktopUpdateArchitecture;
  currentVersion: string;
}

function apiBaseUrl(env: IEnv): string {
  return (env.API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function requireLatestRelease(env: IEnv): Promise<DesktopRelease> {
  const release = await fetchLatestDesktopRelease(env);

  if (!release) {
    throw new AssistantError("No desktop release has been published yet.", ErrorType.NOT_FOUND);
  }

  return release;
}

function streamAsset(asset: Response, name: string, contentType: string): Response {
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "public, max-age=3600",
  });
  const length = asset.headers.get("content-length");

  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(asset.body, { status: 200, headers });
}

export async function getDesktopDownloads(env: IEnv): Promise<DesktopDownloads> {
  const release = await requireLatestRelease(env);
  const base = apiBaseUrl(env);

  return {
    version: release.version,
    released_at: release.publishedAt,
    notes: release.notes,
    downloads: listDesktopDownloads(release, (bundleId) => `${base}/desktop/downloads/${bundleId}`),
  };
}

export async function resolveDesktopUpdate(
  env: IEnv,
  request: DesktopUpdateRequest,
): Promise<DesktopUpdate | null> {
  const bundle = findUpdateBundle(request.target, request.architecture);

  if (!bundle) {
    return null;
  }

  const release = await fetchLatestDesktopRelease(env);

  if (!release || !isNewerVersion(release.version, request.currentVersion)) {
    return null;
  }

  const artifact = findUpdaterArtifact(release, bundle);

  if (!artifact) {
    return null;
  }

  const signature = await fetchReleaseAsset(env, artifact.signature.url);

  return {
    version: release.version,
    notes: release.notes,
    pub_date: release.publishedAt,
    url: `${apiBaseUrl(env)}/desktop/updates/${bundle.id}/${artifact.archive.name}`,
    signature: (await signature.text()).trim(),
  };
}

type BundleAssetSelector = (
  release: DesktopRelease,
  bundle: DesktopBundle,
) => DesktopReleaseAsset | null;

async function resolveBundleAsset(
  env: IEnv,
  bundleId: string,
  select: BundleAssetSelector,
): Promise<DesktopReleaseAsset> {
  const bundle = findBundle(bundleId);

  if (!bundle) {
    throw new AssistantError("That download does not exist.", ErrorType.NOT_FOUND);
  }

  const release = await requireLatestRelease(env);
  const asset = select(release, bundle);

  if (!asset) {
    throw new AssistantError(
      "That download is not part of the current release.",
      ErrorType.NOT_FOUND,
    );
  }

  return asset;
}

export async function streamDesktopArchive(env: IEnv, bundleId: string): Promise<Response> {
  const asset = await resolveBundleAsset(env, bundleId, findArchive);
  const response = await fetchReleaseAsset(env, asset.url);

  return streamAsset(response, asset.name, "application/zip");
}

export async function streamDesktopUpdaterArtifact(
  env: IEnv,
  bundleId: string,
  filename: string,
): Promise<Response> {
  const asset = await resolveBundleAsset(
    env,
    bundleId,
    (release, bundle) => findUpdaterArtifact(release, bundle)?.archive ?? null,
  );

  if (asset.name !== filename) {
    throw new AssistantError("That update is no longer available.", ErrorType.NOT_FOUND);
  }

  const response = await fetchReleaseAsset(env, asset.url);

  return streamAsset(response, asset.name, "application/octet-stream");
}
