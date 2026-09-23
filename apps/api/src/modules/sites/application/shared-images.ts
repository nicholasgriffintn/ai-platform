import { collectSiteImageSlots } from "@ngriffin_uk/polychat-library-sites";
import { SITE_OUTPUT_KIND, siteProjectSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResponse } from "~/infrastructure/storage/read-resource";
import { getPrivateFileResourceFromUrl } from "~/infrastructure/storage/resource-urls";
import { getSharedOutputRecord } from "~/modules/outputs/application";

export async function readSharedSiteImage(
  context: ServiceContext,
  token: string,
  outputId: string,
): Promise<Response> {
  const shared = await getSharedOutputRecord(context, token);
  const content =
    typeof shared.content === "string" ? safeParseJson(shared.content) : shared.content;
  const project = siteProjectSchema.safeParse(
    content && typeof content === "object" ? (content as { project?: unknown }).project : null,
  );

  if (shared.kind !== SITE_OUTPUT_KIND || !project.success) {
    throw new AssistantError("Shared site not found", ErrorType.NOT_FOUND, 404);
  }

  const referenced = collectSiteImageSlots(project.data).some((slot) => {
    const resource = slot.src
      ? getPrivateFileResourceFromUrl(slot.src, context.env.API_BASE_URL)
      : undefined;

    return resource?.kind === "output" && resource.id === outputId;
  });

  if (!referenced) {
    throw new AssistantError("Image is not part of this site", ErrorType.NOT_FOUND, 404);
  }

  const image = await context.repositories.outputs.getOutput(outputId);

  if (
    !image ||
    image.created_by_user_id !== shared.created_by_user_id ||
    !image.storage_key ||
    !image.mime_type?.startsWith("image/")
  ) {
    throw new AssistantError("Image not found", ErrorType.NOT_FOUND, 404);
  }

  const object = await new StorageService(context.env.PRIVATE_ASSETS_BUCKET).getObjectBody(
    image.storage_key,
  );

  if (!object) {
    throw new AssistantError("Image not found", ErrorType.NOT_FOUND, 404);
  }

  return getPrivateFileResponse(image, object);
}
