import { listSitePages, type SitePatch, type SiteProject } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { elementPatchPath } from "./edit.js";

export interface SiteImageSlot {
  pageId: string;
  elementKey: string;
  path: string;
  alt: string;
  aspect: "square" | "video" | "portrait" | "wide";
  src?: string;
}

const HERO_ASPECT = "video";
const GALLERY_ASPECT = "video";

function slot(
  pageId: string,
  elementKey: string,
  path: string,
  alt: unknown,
  aspect: SiteImageSlot["aspect"],
  src: unknown,
): SiteImageSlot | null {
  if (typeof alt !== "string" || !alt.trim()) {
    return null;
  }

  return {
    pageId,
    elementKey,
    path,
    alt: alt.trim(),
    aspect,
    ...(typeof src === "string" && src ? { src } : {}),
  };
}

export function collectSiteImageSlots(project: SiteProject): SiteImageSlot[] {
  const slots: SiteImageSlot[] = [];

  for (const { id: pageId, page } of listSitePages(project)) {
    for (const [key, element] of Object.entries(page.elements)) {
      const props = element.props;

      if (element.type === "Hero" && props.layout === "split") {
        const image = isRecord(props.image) ? props.image : { alt: "Product image" };
        const found = slot(
          pageId,
          key,
          elementPatchPath(pageId, key, "props", "image"),
          image.alt,
          HERO_ASPECT,
          image.src,
        );

        if (found) {
          slots.push(found);
        }
      }

      if (element.type === "Image") {
        const aspect =
          props.aspect === "square" || props.aspect === "portrait" || props.aspect === "wide"
            ? props.aspect
            : "video";
        const found = slot(
          pageId,
          key,
          elementPatchPath(pageId, key, "props"),
          props.alt,
          aspect,
          props.src,
        );

        if (found) {
          slots.push(found);
        }
      }

      if (element.type === "Gallery" && Array.isArray(props.items)) {
        props.items.forEach((item, index) => {
          if (!isRecord(item)) {
            return;
          }

          const found = slot(
            pageId,
            key,
            elementPatchPath(pageId, key, "props", "items", String(index)),
            item.alt,
            GALLERY_ASPECT,
            item.src,
          );

          if (found) {
            slots.push(found);
          }
        });
      }

      if (element.type === "Team" && Array.isArray(props.members)) {
        props.members.forEach((member, index) => {
          if (!isRecord(member)) {
            return;
          }

          const image = isRecord(member.image) ? member.image : null;
          const found = slot(
            pageId,
            key,
            elementPatchPath(pageId, key, "props", "members", String(index), "image"),
            image?.alt ?? (typeof member.name === "string" ? `Portrait of ${member.name}` : null),
            "square",
            image?.src,
          );

          if (found) {
            slots.push(found);
          }
        });
      }
    }
  }

  return slots;
}

export function collectEmptySiteImageSlots(project: SiteProject, limit = 8): SiteImageSlot[] {
  return collectSiteImageSlots(project)
    .filter((entry) => !entry.src)
    .slice(0, limit);
}

export function buildSiteImagePatch(entry: SiteImageSlot, src: string): SitePatch {
  if (entry.path.endsWith("/image")) {
    return { op: "add", path: entry.path, value: { alt: entry.alt, src } };
  }

  return { op: "add", path: `${entry.path}/src`, value: src };
}

export const SITE_IMAGE_ASPECT_RATIOS: Record<SiteImageSlot["aspect"], string> = {
  square: "1:1",
  video: "16:9",
  portrait: "3:4",
  wide: "21:9",
};

export function buildSiteImagePrompt(entry: SiteImageSlot, project: SiteProject): string {
  const subject = entry.alt.replace(/\s+/g, " ");
  const context = project.description ? ` for ${project.description.replace(/\.$/, "")}` : "";

  return `${subject}${context}. Photographic, natural light, no text, no logos, no watermarks, editorial quality, suitable as a website ${entry.aspect === "square" ? "portrait" : "hero"} image.`;
}

export function buildSiteImageRewritePatches(
  project: SiteProject,
  rewrite: (src: string, entry: SiteImageSlot) => string | null,
): SitePatch[] {
  const patches: SitePatch[] = [];

  for (const entry of collectSiteImageSlots(project)) {
    if (!entry.src) {
      continue;
    }

    const next = rewrite(entry.src, entry);

    if (next !== null && next !== entry.src) {
      patches.push(buildSiteImagePatch(entry, next));
    }
  }

  return patches;
}
