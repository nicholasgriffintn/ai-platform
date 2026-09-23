import { sitesService } from "@ngriffin_uk/polychat-library-client";
import { applySitePatch, validateSiteProject } from "@ngriffin_uk/polychat-library-sites";
import type { SiteImageStreamEvent, SiteProject, SiteRecord } from "@ngriffin_uk/polychat-schemas";

export interface SiteImageGenerationProgress {
  completed: number;
  total: number;
  failed: number;
  project?: SiteProject;
}

export interface SiteImageGenerationResult {
  site: SiteRecord;
  status: "done" | "partial" | "failed";
  error: string | null;
}

export async function runSiteImageGeneration({
  site,
  projectId,
  onProgress,
}: {
  site: SiteRecord;
  projectId?: string;
  onProgress: (progress: SiteImageGenerationProgress) => void;
}): Promise<SiteImageGenerationResult> {
  const document = structuredClone(site.project) as unknown as Record<string, unknown>;
  let result: SiteImageGenerationResult | null = null;
  let streamError: string | null = null;

  const handleEvent = (event: SiteImageStreamEvent) => {
    switch (event.type) {
      case "progress": {
        let project: SiteProject | undefined;

        if (event.patch) {
          try {
            applySitePatch(document, event.patch);
            project = validateSiteProject(document).project;
          } catch {
            project = undefined;
          }
        }

        onProgress({
          completed: event.completed,
          total: event.total,
          failed: event.failed,
          ...(project ? { project } : {}),
        });
        break;
      }

      case "saved":
        result = {
          site: event.site,
          status:
            event.generated > 0 && event.failed > 0
              ? "partial"
              : event.generated > 0 || event.failed === 0
                ? "done"
                : "failed",
          error:
            event.failed === 0
              ? null
              : event.generated > 0
                ? `${event.failed} ${event.failed === 1 ? "image" : "images"} could not be generated.`
                : "Images could not be generated. Check image-provider access and try again.",
        };
        break;
      case "error":
        streamError = event.error;
        break;
      default:
        break;
    }
  };

  await sitesService.images(site.id, { projectId }, handleEvent);

  if (streamError) {
    throw new Error(streamError);
  }

  if (!result) {
    throw new Error("Image generation ended before the site was updated.");
  }

  return result;
}
