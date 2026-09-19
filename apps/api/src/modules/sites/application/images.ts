import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  applySitePatch,
  buildSiteImagePatch,
  buildSiteImagePrompt,
  collectEmptySiteImageSlots,
  collectSiteImageSlots,
  SITE_IMAGE_ASPECT_RATIOS,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteImagesResponse, SitePatch, SiteProject } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResourceFromUrl } from "~/infrastructure/storage/resource-urls";
import { generateImage } from "~/modules/generate/application/image";
import type { IUser } from "~/types";

import { getSite, updateSite } from "./records";

const logger = getLogger({ prefix: "services/sites/images" });

const SITE_IMAGE_CONCURRENCY = 3;

export interface FillSiteImagesOptions {
  context: ServiceContext;
  user: IUser;
  siteId: string;
  projectId?: string;
  limit?: number;
}

export async function fillSiteImages({
  context,
  user,
  siteId,
  projectId,
  limit,
}: FillSiteImagesOptions): Promise<SiteImagesResponse> {
  const scope = { context, userId: user.id, projectId };
  const site = await getSite(scope, siteId);
  const slots = collectEmptySiteImageSlots(site.project, limit);

  if (slots.length === 0) {
    return { site, generated: 0, failed: 0 };
  }

  const patches: SitePatch[] = [];
  let failed = 0;
  const queue = [...slots];

  const worker = async () => {
    while (queue.length > 0) {
      const entry = queue.shift();

      if (!entry) {
        return;
      }

      try {
        const result = await generateImage({
          completion_id: `site-image-${generateId()}`,
          app_url: context.env.APP_BASE_URL,
          context,
          user,
          args: {
            prompt: buildSiteImagePrompt(entry, site.project),
            aspect_ratio: SITE_IMAGE_ASPECT_RATIOS[entry.aspect],
          },
        });
        const url = (result.data as { url?: unknown })?.url;

        if (result.status !== "success" || typeof url !== "string" || !url) {
          failed += 1;
          continue;
        }

        patches.push(buildSiteImagePatch(entry, url));
      } catch (error) {
        failed += 1;
        logger.warn("Site image generation failed", {
          site_id: siteId,
          element: entry.elementKey,
          error_message: getErrorMessage(error),
        });
      }
    }
  };

  await Promise.all(Array.from({ length: SITE_IMAGE_CONCURRENCY }, worker));

  if (patches.length === 0) {
    return { site, generated: 0, failed };
  }

  const document = structuredClone(site.project) as unknown as Record<string, unknown>;

  for (const patch of patches) {
    applySitePatch(document, patch);
  }

  const { project, issues } = validateSiteProject(document);
  const saved = await updateSite(scope, siteId, {
    brief: site.brief,
    plan: site.plan,
    project,
    issues,
    turn: {
      id: `images-${generateId()}`,
      role: "edit",
      prompt: `Generated ${patches.length} ${patches.length === 1 ? "image" : "images"}`,
      createdAt: new Date().toISOString(),
    },
  });

  return { site: saved, generated: patches.length, failed };
}

export interface SiteImageAsset {
  path: string;
  content: string;
  encoding: "base64";
  src: string;
  publicPath: string;
}

export async function collectSiteImageAssets(
  context: ServiceContext,
  project: SiteProject,
): Promise<SiteImageAsset[]> {
  const storage = StorageService.forPrivateAssets(context);
  const assets = new Map<string, SiteImageAsset>();

  for (const entry of collectSiteImageSlots(project)) {
    if (!entry.src || assets.has(entry.src)) {
      continue;
    }

    const resource = getPrivateFileResourceFromUrl(entry.src, context.env.API_BASE_URL);

    if (!resource || resource.kind !== "output") {
      continue;
    }

    const record = await context.repositories.outputs.getOutput(resource.id);

    if (!record?.storage_key) {
      continue;
    }

    const content = await storage.getObject(record.storage_key);

    if (!content) {
      continue;
    }

    const extension =
      record.mime_type === "image/jpeg"
        ? "jpg"
        : record.mime_type === "image/webp"
          ? "webp"
          : "png";
    const publicPath = `/images/${resource.id}.${extension}`;

    assets.set(entry.src, {
      path: `public${publicPath}`,
      content,
      encoding: "base64",
      src: entry.src,
      publicPath,
    });
  }

  return [...assets.values()];
}
