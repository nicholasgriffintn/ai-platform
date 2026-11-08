import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import type { IRequest } from "~/types";

import type { PreviewViewport, ViewportPreview } from "./render";

export const MAX_PREVIEW_SCREENSHOT_BYTES = 800 * 1024;

export type PreviewScreenshot =
  | { viewport: PreviewViewport; status: "kept"; base64: string; byteSize: number }
  | { viewport: PreviewViewport; status: "omitted"; reason: string };

export type StoredPreviewScreenshot =
  | { viewport: PreviewViewport; status: "attached"; url: string }
  | { viewport: PreviewViewport; status: "omitted"; reason: string };

function decodedByteSize(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  return Math.floor((base64.length * 3) / 4) - padding;
}

export function selectPreviewScreenshots(
  previews: readonly ViewportPreview[],
  maxBytes = MAX_PREVIEW_SCREENSHOT_BYTES,
): PreviewScreenshot[] {
  return previews.flatMap((preview): PreviewScreenshot[] => {
    if (preview.status !== "rendered") {
      return [];
    }

    const byteSize = decodedByteSize(preview.screenshot);

    return [
      byteSize > maxBytes
        ? {
            viewport: preview.viewport,
            status: "omitted",
            reason: `the image is ${Math.ceil(byteSize / 1024)} KB, over the ${Math.floor(maxBytes / 1024)} KB limit`,
          }
        : { viewport: preview.viewport, status: "kept", base64: preview.screenshot, byteSize },
    ];
  });
}

export async function storePreviewScreenshots(
  request: IRequest,
  screenshots: readonly PreviewScreenshot[],
): Promise<StoredPreviewScreenshot[]> {
  const user = request.user;

  if (!user?.id) {
    return screenshots.map(({ viewport }) => ({
      viewport,
      status: "omitted",
      reason: "screenshots need a signed-in user",
    }));
  }

  const storage = StorageService.forPrivateAssets(
    resolveServiceContext({ context: request.context, env: request.env, user }),
  );
  const groupId = generateId();

  return Promise.all(
    screenshots.map(async (screenshot): Promise<StoredPreviewScreenshot> => {
      if (screenshot.status === "omitted") {
        return screenshot;
      }

      try {
        const stored = await storage.storeOutputFile({
          key: `screenshots/previews/${groupId}/${screenshot.viewport}.png`,
          data: base64ToBuffer(screenshot.base64),
          createdByUserId: user.id,
          capabilityId: "retrieval",
          groupId,
          kind: "screenshot",
          title: `Artifact preview (${screenshot.viewport})`,
          content: { viewport: screenshot.viewport },
          mimeType: "image/png",
          filename: `preview-${screenshot.viewport}.png`,
          byteSize: screenshot.byteSize,
        });

        return { viewport: screenshot.viewport, status: "attached", url: stored.url };
      } catch (error) {
        return {
          viewport: screenshot.viewport,
          status: "omitted",
          reason: `the image could not be stored: ${getErrorMessage(error).slice(0, 200)}`,
        };
      }
    }),
  );
}
