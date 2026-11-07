import { fetchApi } from "@ngriffin_uk/polychat-library-client";
import {
  collectSiteImageSlots,
  rewriteSiteProjectImages,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteProject } from "@ngriffin_uk/polychat-schemas";
import { blobToDataUrl } from "@ngriffin_uk/polychat-utility-core";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

const PRIVATE_FILE_PATH = /^\/(?:outputs|sources)\/[^/]+\/content$/;

function privateFilePath(src: string): string | null {
  try {
    const { pathname } = new URL(src, "https://polychat.local");

    return PRIVATE_FILE_PATH.test(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

async function fetchPrivateImage(path: string): Promise<string | null> {
  const response = await fetchApi(path);

  return response.ok ? blobToDataUrl(await response.blob()) : null;
}

export function useSitePreviewProject(project: SiteProject | null): SiteProject | null {
  const sources = useMemo(
    () => [
      ...new Set(
        (project ? collectSiteImageSlots(project) : []).flatMap((slot) =>
          slot.src && privateFilePath(slot.src) ? [slot.src] : [],
        ),
      ),
    ],
    [project],
  );
  const images = useQueries({
    queries: sources.map((src) => ({
      queryKey: ["site-preview-image", src],
      queryFn: () => fetchPrivateImage(privateFilePath(src) ?? src),
      staleTime: Number.POSITIVE_INFINITY,
    })),
    combine: (results) => results.map((result) => (result.isPending ? "" : (result.data ?? null))),
  });

  return useMemo(() => {
    if (!project) {
      return null;
    }

    const loaded = new Map(sources.map((src, index) => [src, images[index] ?? null]));

    return rewriteSiteProjectImages(project, (src) => loaded.get(src) ?? null);
  }, [images, project, sources]);
}
