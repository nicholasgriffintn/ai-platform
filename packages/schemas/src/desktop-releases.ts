import z from "zod/v4";

export const DESKTOP_UPDATE_TARGETS = ["darwin", "linux", "windows"] as const;
export const DESKTOP_UPDATE_ARCHITECTURES = ["x86_64", "aarch64", "i686", "armv7"] as const;
export const DESKTOP_PLATFORMS = ["macos", "linux", "windows"] as const;

export const desktopUpdateParamsSchema = z.object({
  target: z.enum(DESKTOP_UPDATE_TARGETS),
  arch: z.enum(DESKTOP_UPDATE_ARCHITECTURES),
  current_version: z.string().min(1),
});

export const desktopUpdateSchema = z.object({
  version: z.string(),
  notes: z.string(),
  pub_date: z.string(),
  url: z.string(),
  signature: z.string(),
});

export const desktopDownloadSchema = z.object({
  id: z.string(),
  platform: z.enum(DESKTOP_PLATFORMS),
  architecture: z.string(),
  label: z.string(),
  filename: z.string(),
  size: z.number().int().nonnegative(),
  url: z.string(),
});

export const desktopDownloadsSchema = z.object({
  version: z.string(),
  released_at: z.string(),
  notes: z.string(),
  downloads: z.array(desktopDownloadSchema),
});

export const desktopDownloadParamsSchema = z.object({
  id: z.string().min(1),
});

export type DesktopUpdateTarget = (typeof DESKTOP_UPDATE_TARGETS)[number];
export type DesktopUpdateArchitecture = (typeof DESKTOP_UPDATE_ARCHITECTURES)[number];
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number];
export type DesktopUpdate = z.infer<typeof desktopUpdateSchema>;
export type DesktopDownload = z.infer<typeof desktopDownloadSchema>;
export type DesktopDownloads = z.infer<typeof desktopDownloadsSchema>;
