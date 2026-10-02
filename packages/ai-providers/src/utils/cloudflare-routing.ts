import { resolveCloudflareAutoRouterModel, modelConfig } from "@ngriffin_uk/polychat-ai-models";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export async function getCloudflareRoutingUsage(
  response: Response,
): Promise<Record<string, string>> {
  const routedModel = response.headers.get("cf-aig-routed-model");

  if (!routedModel || !resolveCloudflareAutoRouterModel(modelConfig, routedModel)) {
    await response.body?.cancel();

    throw new AssistantError(
      "Cloudflare Auto Router returned an unrecognised routed model",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return { cloudflare_routed_model: routedModel };
}

export function addCloudflareRoutingUsage(
  stream: ReadableStream<Uint8Array>,
  usage: Record<string, string>,
): ReadableStream<Uint8Array> {
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, ...usage } })}\n\n`,
          ),
        );
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    }),
  );
}
