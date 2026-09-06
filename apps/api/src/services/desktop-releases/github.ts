import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { DesktopRelease } from "./assets";

const GITHUB_API_ORIGIN = "https://api.github.com";
const DEFAULT_REPOSITORY = "nicholasgriffintn/ai-platform";
const RELEASE_TAG_PREFIX = "desktop-v";
const RELEASE_CACHE_SECONDS = 300;
const USER_AGENT = "polychat-api";

const ALLOWED_ASSET_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

interface GitHubReleaseAsset {
  name?: string;
  size?: number;
  browser_download_url?: string;
}

interface GitHubRelease {
  tag_name?: string;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string | null;
  assets?: GitHubReleaseAsset[];
}

function repository(env: IEnv): string {
  return env.DESKTOP_RELEASES_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
}

function requestHeaders(env: IEnv): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (env.DESKTOP_RELEASES_TOKEN) {
    headers.Authorization = `Bearer ${env.DESKTOP_RELEASES_TOKEN}`;
  }

  return headers;
}

function toDesktopRelease(release: GitHubRelease): DesktopRelease | null {
  const tag = release.tag_name;

  if (!tag?.startsWith(RELEASE_TAG_PREFIX) || release.draft || release.prerelease) {
    return null;
  }

  const assets = (release.assets ?? []).flatMap((asset) =>
    asset.name && asset.browser_download_url
      ? [{ name: asset.name, size: asset.size ?? 0, url: asset.browser_download_url }]
      : [],
  );

  return {
    version: tag.slice(RELEASE_TAG_PREFIX.length),
    notes: release.body?.trim() ?? "",
    publishedAt: release.published_at ?? new Date(0).toISOString(),
    assets,
  };
}

export async function fetchLatestDesktopRelease(env: IEnv): Promise<DesktopRelease | null> {
  const response = await fetch(
    `${GITHUB_API_ORIGIN}/repos/${repository(env)}/releases?per_page=30`,
    {
      headers: requestHeaders(env),
      cf: { cacheTtl: RELEASE_CACHE_SECONDS, cacheEverything: true },
    },
  );

  if (!response.ok) {
    throw new AssistantError(
      `The release catalogue could not be read (${response.status}).`,
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  const releases = (await response.json()) as GitHubRelease[];

  for (const release of releases) {
    const desktop = toDesktopRelease(release);

    if (desktop) {
      return desktop;
    }
  }

  return null;
}

export function assertReleaseAssetUrl(url: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AssistantError("The download address is not usable.", ErrorType.EXTERNAL_API_ERROR);
  }

  if (parsed.protocol !== "https:" || !ALLOWED_ASSET_HOSTS.has(parsed.hostname)) {
    throw new AssistantError(
      "The download address is not a recognised release location.",
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  return parsed;
}

export async function fetchReleaseAsset(env: IEnv, url: string): Promise<Response> {
  const response = await fetch(assertReleaseAssetUrl(url), {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": USER_AGENT,
      ...(env.DESKTOP_RELEASES_TOKEN
        ? { Authorization: `Bearer ${env.DESKTOP_RELEASES_TOKEN}` }
        : {}),
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new AssistantError("That download is not available.", ErrorType.NOT_FOUND);
  }

  return response;
}
