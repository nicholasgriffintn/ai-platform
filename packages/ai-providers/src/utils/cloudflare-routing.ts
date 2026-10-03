export function addCloudflareRoutingUsage(
  stream: ReadableStream<Uint8Array>,
  routedModel: string,
): ReadableStream<Uint8Array> {
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, cloudflare_routed_model: routedModel } })}\n\n`,
          ),
        );
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    }),
  );
}
