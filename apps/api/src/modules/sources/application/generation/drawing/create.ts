import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import type { SourceGeneration } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { buildMultipartInput } from "@ngriffin_uk/polychat-utility-server/multipart-input";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { describePicture } from "~/modules/generate/application/vision";
import { storeKnowledgeFile } from "~/modules/knowledge/application/intake/file";
import { requireSystemModel } from "~/modules/models/application/resolve";
import { getSource } from "~/modules/sources/application/sources";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { drawingDescriptionPrompt } from "./prompts";

const paintingResponseSchema = z.object({ image: z.string().min(1) });

function gatewayOptions(email: string | undefined) {
  return {
    gateway: { id: resolveAiGatewayId(), skipCache: false, cacheTtl: 3360, metadata: { email } },
  };
}

/** Keeps a sketch as an image source and paints it into a second, generated image source. */
export async function paintDrawing(
  context: ServiceContext,
  drawing: Blob,
  projectId?: string | null,
) {
  const user = context.requireUser();

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  const sketch = await drawing.arrayBuffer();
  const storageId = generateId();
  const { source: storedSketch } = await storeKnowledgeFile(context, {
    origin: "upload",
    kind: "file",
    provider: null,
    content: undefined,
    key: `drawings/${storageId}/image.png`,
    data: sketch,
    projectId: projectId ?? null,
    title: "Sketch",
    mimeType: "image/png",
    filename: "sketch.png",
    byteSize: sketch.byteLength,
  });
  const [description, repaint] = await Promise.all([
    describePicture(context, {
      prompt: drawingDescriptionPrompt(),
      image: sketch,
      mimeType: drawing.type || "image/png",
    }),
    requireSystemModel(context.env, user, "repaint", {}, { inputs: ["image"] }),
  ]);
  const prompt = description || "Convert this drawing into a painting.";
  const { multipart } = await buildMultipartInput({ prompt }, [
    {
      field: "input_image_0",
      data: sketch,
      filename: "sketch.png",
      contentType: drawing.type || "image/png",
    },
  ]);
  const painting = await context.env.AI.run(
    repaint.model,
    { multipart },
    gatewayOptions(user.email),
  );
  const paintingImage = paintingResponseSchema.safeParse(painting);

  if (!paintingImage.success) {
    throw new AssistantError("The painting was not generated", ErrorType.PROVIDER_ERROR);
  }

  const paintingData = base64ToBuffer(paintingImage.data.image).buffer;
  const generation: SourceGeneration = {
    type: "drawing",
    modelId: repaint.id,
    modelName: repaint.name,
    provider: repaint.provider,
    mode: "image",
    prompt,
    sourceIds: [storedSketch.id],
  };
  const { source: storedPainting } = await storeKnowledgeFile(context, {
    origin: "generated",
    kind: "file",
    provider: null,
    key: `drawings/${storageId}/painting.png`,
    data: paintingData,
    projectId: projectId ?? null,
    title: prompt.slice(0, 200),
    content: prompt,
    metadata: { generation },
    mimeType: "image/png",
    filename: "painting.png",
    byteSize: paintingData.byteLength,
  });

  return getSource(context, user.id, storedPainting.id);
}
