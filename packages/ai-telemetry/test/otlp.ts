import type { BeaconFetcher, TelemetrySpan } from "../src/types.js";

export const operationalSpan: TelemetrySpan = {
  traceId: "run-123",
  spanId: "span-123",
  name: "provider.call",
  startTime: 1000,
  endTime: 1250,
  status: "ok",
  attributes: { provider: "openai" },
};

export function createCollector() {
  const requests: Array<{ url: string; init: RequestInit; body: string }> = [];
  const fetcher: BeaconFetcher = async (url, init) => {
    const request = new Request(url, init);

    requests.push({ url, init, body: await request.text() });

    return new Response("{}", { status: 200 });
  };

  return { requests, fetcher };
}
