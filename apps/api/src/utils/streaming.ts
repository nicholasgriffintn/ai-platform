export function detectStreaming(body: Record<string, any>, endpoint: string) {
  const isStreaming = body?.stream === true;
  const isEndpointStreaming = endpoint.includes("streamGenerateContent");
  return isStreaming || isEndpointStreaming;
}
