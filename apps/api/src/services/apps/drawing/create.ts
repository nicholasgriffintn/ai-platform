import { gatewayId } from "~/constants/app";
import type { ConversationManager } from "~/lib/conversationManager";
import { drawingDescriptionPrompt } from "~/lib/prompts";
import { StorageService } from "~/lib/storage";
import { RepositoryManager } from "~/repositories";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

interface ImageFromDrawingResponse extends IFunctionResponse {
  completion_id?: string;
}

export async function generateImageFromDrawing({
  env,
  request,
  user,
  conversationManager,
  existingDrawingId,
}: {
  env: IEnv;
  request: {
    drawing?: Blob;
    drawingId?: string;
  };
  user: IUser;
  conversationManager?: ConversationManager;
  existingDrawingId?: string;
}): Promise<ImageFromDrawingResponse> {
  if (!request.drawing) {
    throw new AssistantError("Missing drawing", ErrorType.PARAMS_ERROR);
  }

  const arrayBuffer = await request.drawing.arrayBuffer();
  const length = arrayBuffer.byteLength;

  const drawingId = request.drawingId || existingDrawingId || generateId();
  const drawingImageKey = `drawings/${drawingId}/image.png`;

  let drawingUrl = "";
  try {
    const storageService = new StorageService(env.ASSETS_BUCKET);
    drawingUrl = await storageService.uploadObject(
      drawingImageKey,
      arrayBuffer,
      {
        contentType: "image/png",
        contentLength: length,
      },
    );
  } catch (error) {
    throw new AssistantError("Error uploading drawing");
  }

  const descriptionRequest = await env.AI.run(
    "@cf/llava-hf/llava-1.5-7b-hf",
    {
      prompt: drawingDescriptionPrompt(),
      image: [...new Uint8Array(arrayBuffer)],
    },
    {
      gateway: {
        id: gatewayId,
        skipCache: false,
        cacheTtl: 3360,
        metadata: {
          email: user?.email,
        },
      },
    },
  );

  const painting = await env.AI.run(
    "@cf/runwayml/stable-diffusion-v1-5-img2img",
    {
      prompt:
        descriptionRequest?.description ||
        "Convert this drawing into a painting.",
      image: [...new Uint8Array(arrayBuffer)],
      guidance: 8,
      strength: 0.85,
      // @ts-ignore
      num_inference_steps: 50,
    },
    {
      gateway: {
        id: gatewayId,
        skipCache: false,
        cacheTtl: 3360,
        metadata: {
          email: user?.email,
        },
      },
    },
  );

  const paintingArrayBuffer = await new Response(painting).arrayBuffer();
  const paintingLength = paintingArrayBuffer.byteLength;

  const paintingImageKey = `drawings/${drawingId}/painting.png`;
  try {
    const storageService = new StorageService(env.ASSETS_BUCKET);
    await storageService.uploadObject(paintingImageKey, paintingArrayBuffer, {
      contentType: "image/png",
      contentLength: paintingLength,
    });
  } catch (error) {
    throw new AssistantError("Error uploading painting");
  }

  let conversationResponse: any = { status: "success" };
  const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";

  if (conversationManager) {
    await conversationManager.add(drawingId, {
      role: "user",
      content: `Generate a drawing with this prompt: ${descriptionRequest?.description}`,
      app: "drawings",
    });

    const message = {
      role: "assistant" as ChatRole,
      name: "drawing_generate",
      content: descriptionRequest?.description,
      data: {
        drawingUrl: `${baseAssetsUrl}/${drawingImageKey}`,
        drawingKey: drawingImageKey,
        paintingUrl: `${baseAssetsUrl}/${paintingImageKey}`,
        paintingKey: paintingImageKey,
      },
    };
    conversationResponse = await conversationManager.add(drawingId, message);
  }

  const repo = RepositoryManager.getInstance(env).appData;

  const appDataResponse = await repo.createAppDataWithItem(
    user.id,
    "drawings",
    drawingId,
    "drawing",
    {
      description: descriptionRequest?.description || "Untitled drawing",
      drawingUrl: `${baseAssetsUrl}/${drawingImageKey}`,
      paintingUrl: `${baseAssetsUrl}/${paintingImageKey}`,
      drawingKey: drawingImageKey,
      paintingKey: paintingImageKey,
    },
  );

  const appDataId = appDataResponse.id;

  return {
    ...conversationResponse,
    app_data_id: appDataId,
    completion_id: drawingId,
    status: "success",
    data: {
      drawingUrl: `${baseAssetsUrl}/${drawingImageKey}`,
      drawingKey: drawingImageKey,
      paintingUrl: `${baseAssetsUrl}/${paintingImageKey}`,
      paintingKey: paintingImageKey,
      description: descriptionRequest?.description || "Untitled drawing",
    },
  };
}
