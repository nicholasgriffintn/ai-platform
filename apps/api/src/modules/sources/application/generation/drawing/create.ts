import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import type { SourceGeneration } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { storeKnowledgeFile } from "~/modules/knowledge/application/intake/file";
import { getSource } from "~/modules/sources/application/sources";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { drawingDescriptionPrompt } from "./prompts";

const PAINTING_MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";

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
  const description = await context.env.AI.run(
    "@cf/llava-hf/llava-1.5-7b-hf",
    { prompt: drawingDescriptionPrompt(), image: [...new Uint8Array(sketch)] },
    gatewayOptions(user.email),
  );
  const prompt = description?.description?.trim() || "Convert this drawing into a painting.";
  const painting = await context.env.AI.run(
    // @ts-ignore img2img is not in the generated binding types
    PAINTING_MODEL,
    {
      prompt,
      image: [...new Uint8Array(sketch)],
      guidance: 8,
      strength: 0.85,
      // @ts-ignore
      num_inference_steps: 50,
    },
    gatewayOptions(user.email),
  );

  if (!painting) {
    throw new AssistantError("The painting was not generated", ErrorType.PROVIDER_ERROR);
  }

  // @ts-expect-error the binding returns a stream for image models
  const paintingData = await new Response(painting).arrayBuffer();
  const generation: SourceGeneration = {
    type: "drawing",
    modelId: PAINTING_MODEL,
    modelName: "Stable Diffusion img2img",
    provider: "workers-ai",
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
