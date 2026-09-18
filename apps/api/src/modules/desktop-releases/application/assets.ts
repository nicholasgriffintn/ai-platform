import type {
  DesktopDownload,
  DesktopPlatform,
  DesktopUpdateArchitecture,
  DesktopUpdateTarget,
} from "@ngriffin_uk/polychat-schemas";

export interface DesktopReleaseAsset {
  name: string;
  size: number;
  url: string;
}

export interface DesktopRelease {
  version: string;
  notes: string;
  publishedAt: string;
  assets: DesktopReleaseAsset[];
}

export interface DesktopBundle {
  id: string;
  platform: DesktopPlatform;
  architecture: string;
  label: string;
  archiveSuffix: string;
  updaterSuffix: string;
}

export const DESKTOP_BUNDLES: readonly DesktopBundle[] = [
  {
    id: "macos-universal",
    platform: "macos",
    architecture: "universal",
    label: "macOS (Apple silicon and Intel)",
    archiveSuffix: "-macos-universal.zip",
    updaterSuffix: "-macos-universal.app.tar.gz",
  },
  {
    id: "linux-x86_64",
    platform: "linux",
    architecture: "x86_64",
    label: "Linux (x86-64)",
    archiveSuffix: "-linux-x86_64.zip",
    updaterSuffix: "-linux-x86_64.AppImage",
  },
  {
    id: "windows-x86_64",
    platform: "windows",
    architecture: "x86_64",
    label: "Windows (x86-64)",
    archiveSuffix: "-windows-x86_64.zip",
    updaterSuffix: "-windows-x86_64-setup.exe",
  },
];

const UPDATE_BUNDLE_IDS: Record<
  DesktopUpdateTarget,
  Partial<Record<DesktopUpdateArchitecture, string>>
> = {
  darwin: { x86_64: "macos-universal", aarch64: "macos-universal" },
  linux: { x86_64: "linux-x86_64" },
  windows: { x86_64: "windows-x86_64" },
};

export function findBundle(id: string): DesktopBundle | null {
  return DESKTOP_BUNDLES.find((bundle) => bundle.id === id) ?? null;
}

export function findUpdateBundle(
  target: DesktopUpdateTarget,
  architecture: DesktopUpdateArchitecture,
): DesktopBundle | null {
  const id = UPDATE_BUNDLE_IDS[target]?.[architecture];

  return id ? findBundle(id) : null;
}

function findAsset(release: DesktopRelease, suffix: string): DesktopReleaseAsset | null {
  return release.assets.find((asset) => asset.name.endsWith(suffix)) ?? null;
}

export function findArchive(
  release: DesktopRelease,
  bundle: DesktopBundle,
): DesktopReleaseAsset | null {
  return findAsset(release, bundle.archiveSuffix);
}

export interface DesktopUpdaterArtifact {
  archive: DesktopReleaseAsset;
  signature: DesktopReleaseAsset;
}

export function findUpdaterArtifact(
  release: DesktopRelease,
  bundle: DesktopBundle,
): DesktopUpdaterArtifact | null {
  const archive = findAsset(release, bundle.updaterSuffix);
  const signature = findAsset(release, `${bundle.updaterSuffix}.sig`);

  return archive && signature ? { archive, signature } : null;
}

export function listDesktopDownloads(
  release: DesktopRelease,
  downloadUrl: (bundleId: string) => string,
): DesktopDownload[] {
  const downloads: DesktopDownload[] = [];

  for (const bundle of DESKTOP_BUNDLES) {
    const archive = findArchive(release, bundle);

    if (!archive) {
      continue;
    }

    downloads.push({
      id: bundle.id,
      platform: bundle.platform,
      architecture: bundle.architecture,
      label: bundle.label,
      filename: archive.name,
      size: archive.size,
      url: downloadUrl(bundle.id),
    });
  }

  return downloads;
}
