import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { assertReleaseAssetUrl } from "../github";
import { getDesktopDownloads, resolveDesktopUpdate, streamDesktopArchive } from "../index";

const RELEASE_ASSET_ORIGIN = "https://objects.githubusercontent.com/polychat";

function release(version: string, assets: string[]) {
  return {
    tag_name: `desktop-v${version}`,
    body: `Fixed the perch.`,
    draft: false,
    prerelease: false,
    published_at: "2026-09-06T10:00:00Z",
    assets: assets.map((name) => ({
      name,
      size: 1024,
      browser_download_url: `${RELEASE_ASSET_ORIGIN}/${name}`,
    })),
  };
}

const PUBLISHED_ASSETS = [
  "polychat-desktop-1.2.0-macos-universal.zip",
  "polychat-desktop-1.2.0-macos-universal.app.tar.gz",
  "polychat-desktop-1.2.0-macos-universal.app.tar.gz.sig",
  "polychat-desktop-1.2.0-windows-x86_64.zip",
];

const env = {
  API_BASE_URL: "https://api.polychat.app",
  DESKTOP_RELEASES_REPOSITORY: "owner/repository",
} as IEnv;

function respondWith(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      handler(typeof input === "string" ? input : input.toString()),
    ),
  );
}

beforeEach(() => {
  respondWith((url) => {
    if (url.startsWith("https://api.github.com/")) {
      return Response.json([
        { tag_name: "web-v3.0.0", draft: false, prerelease: false, assets: [] },
        release("1.2.0", PUBLISHED_ASSETS),
      ]);
    }

    if (url.endsWith(".sig")) {
      return new Response("signature-body\n");
    }

    return new Response("binary", { headers: { "content-length": "6" } });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDesktopDownloads", () => {
  it("only offers bundles the release actually published, addressed through the API", async () => {
    const downloads = await getDesktopDownloads(env);

    expect(downloads.version).toBe("1.2.0");
    expect(downloads.downloads.map((download) => download.id)).toEqual([
      "macos-universal",
      "windows-x86_64",
    ]);
    expect(downloads.downloads[0].url).toBe(
      "https://api.polychat.app/desktop/downloads/macos-universal",
    );
  });

  it("refuses to describe a catalogue with no desktop release", async () => {
    respondWith(() => Response.json([{ tag_name: "web-v3.0.0", draft: false, assets: [] }]));

    await expect(getDesktopDownloads(env)).rejects.toThrow(/no desktop release/i);
  });
});

describe("resolveDesktopUpdate", () => {
  it("offers a newer build without naming where it is hosted", async () => {
    const update = await resolveDesktopUpdate(env, {
      target: "darwin",
      architecture: "aarch64",
      currentVersion: "1.1.0",
    });

    expect(update).toMatchObject({
      version: "1.2.0",
      signature: "signature-body",
      url: "https://api.polychat.app/desktop/updates/macos-universal/polychat-desktop-1.2.0-macos-universal.app.tar.gz",
    });
  });

  it("stays quiet when the installed version is already current", async () => {
    await expect(
      resolveDesktopUpdate(env, {
        target: "darwin",
        architecture: "aarch64",
        currentVersion: "1.2.0",
      }),
    ).resolves.toBeNull();
  });

  it("stays quiet when the platform has no signed artefact", async () => {
    await expect(
      resolveDesktopUpdate(env, {
        target: "windows",
        architecture: "x86_64",
        currentVersion: "1.1.0",
      }),
    ).resolves.toBeNull();
  });

  it("stays quiet for a platform the release does not cover", async () => {
    await expect(
      resolveDesktopUpdate(env, {
        target: "linux",
        architecture: "armv7",
        currentVersion: "1.1.0",
      }),
    ).resolves.toBeNull();
  });
});

describe("streamDesktopArchive", () => {
  it("names the archive it hands back", async () => {
    const response = await streamDesktopArchive(env, "macos-universal");

    expect(response.headers.get("content-disposition")).toContain(
      "polychat-desktop-1.2.0-macos-universal.zip",
    );
  });

  it("rejects a bundle that does not exist", async () => {
    await expect(streamDesktopArchive(env, "solaris-sparc")).rejects.toThrow(/does not exist/i);
  });
});

describe("assertReleaseAssetUrl", () => {
  it("refuses an address outside the release hosts", () => {
    expect(() => assertReleaseAssetUrl("https://attacker.example/payload.zip")).toThrow(
      /recognised release location/i,
    );
    expect(() => assertReleaseAssetUrl("http://github.com/payload.zip")).toThrow(
      /recognised release location/i,
    );
  });

  it("accepts a published release asset", () => {
    expect(assertReleaseAssetUrl(`${RELEASE_ASSET_ORIGIN}/bundle.zip`).hostname).toBe(
      "objects.githubusercontent.com",
    );
  });
});
