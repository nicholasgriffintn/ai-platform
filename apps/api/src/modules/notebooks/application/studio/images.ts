import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResourceFromUrl } from "~/infrastructure/storage/resource-urls";
import { generateImage } from "~/modules/generate/application/image";
import { getImageModel } from "~/modules/models/application/resolve";
import { deleteOutput } from "~/modules/outputs/application";

const generatedImageSchema = z.object({ url: z.string() });

export interface StudioImageRequest {
  completionId: string;
  prompt: string;
  aspectRatio: string;
  width: number;
  height: number;
}

export async function drawStudioImage(
  context: ServiceContext,
  params: StudioImageRequest,
): Promise<{ url: string }> {
  const user = context.requireUser();
  const model = await getImageModel(context.env, user);

  if (!model?.id) {
    throw new AssistantError(
      "No image model is available for this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const result = await generateImage({
    completion_id: params.completionId,
    app_url: context.env.APP_BASE_URL,
    context,
    user,
    args: {
      model: model.id,
      provider: model.provider,
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      width: params.width,
      height: params.height,
    },
  });
  const image = generatedImageSchema.safeParse(result.data);

  if (result.status !== "success" || !image.success) {
    throw new AssistantError(
      result.content || "The image model returned no picture",
      ErrorType.PROVIDER_ERROR,
    );
  }

  return image.data;
}

export async function generateStudioImage(
  context: ServiceContext,
  params: StudioImageRequest,
): Promise<Blob | null> {
  const user = context.requireUser();
  const { url } = await drawStudioImage(context, params);
  const image = await StorageService.forPrivateAssets(context).getPrivateAssetImageBlob(
    url,
    user.id,
  );
  const generated = getPrivateFileResourceFromUrl(url, context.env.API_BASE_URL);

  if (generated?.kind === "output") {
    await deleteOutput(context, user.id, generated.id);
  }

  return image;
}
