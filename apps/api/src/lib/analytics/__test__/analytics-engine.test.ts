import { describe, expect, it, vi } from "vitest";

import { writeAnalyticsEngineMetric } from "../analytics-engine";
import { ANALYTICS_ENGINE_BLOB_COLUMNS, ANALYTICS_ENGINE_DOUBLE_COLUMNS } from "../dataset-layout";

function captureDataPoint() {
  const writeDataPoint = vi.fn();

  return {
    writeDataPoint,
    dataset: { writeDataPoint } as never,
  };
}

describe("writeAnalyticsEngineMetric", () => {
  it("promotes numeric metadata into fixed double positions and groups on the metric name", () => {
    const { writeDataPoint, dataset } = captureDataPoint();

    writeAnalyticsEngineMetric(dataset, {
      traceId: "trace-1",
      timestamp: 1_756_600_000_000,
      type: "usage",
      name: "ai_token_usage",
      value: 1500,
      status: "success",
      metadata: {
        provider: "anthropic",
        model: "claude-sonnet-5",
        latency: 812,
        input_tokens: 1000,
        output_tokens: 500,
        total_tokens: 1500,
        cached_input_tokens: 200,
        cache_creation_tokens: 50,
        reasoning_tokens: 25,
      },
    });

    const [dataPoint] = writeDataPoint.mock.calls[0];
    const blobAt = (column: (typeof ANALYTICS_ENGINE_BLOB_COLUMNS)[number]) =>
      dataPoint.blobs[ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf(column)];
    const doubleAt = (column: (typeof ANALYTICS_ENGINE_DOUBLE_COLUMNS)[number]) =>
      dataPoint.doubles[ANALYTICS_ENGINE_DOUBLE_COLUMNS.indexOf(column)];

    expect(dataPoint.indexes).toEqual(["ai_token_usage"]);
    expect(blobAt("provider")).toBe("anthropic");
    expect(blobAt("model")).toBe("claude-sonnet-5");
    expect(JSON.parse(blobAt("metadata"))).toMatchObject({ provider: "anthropic" });
    expect(doubleAt("latencyMs")).toBe(812);
    expect(doubleAt("inputTokens")).toBe(1000);
    expect(doubleAt("outputTokens")).toBe(500);
    expect(doubleAt("cachedInputTokens")).toBe(200);
    expect(doubleAt("reasoningTokens")).toBe(25);
    expect(dataPoint.doubles).toHaveLength(ANALYTICS_ENGINE_DOUBLE_COLUMNS.length);
    expect(dataPoint.blobs).toHaveLength(ANALYTICS_ENGINE_BLOB_COLUMNS.length);
  });

  it("writes zeroed doubles when a metric carries no numeric metadata", () => {
    const { writeDataPoint, dataset } = captureDataPoint();

    writeAnalyticsEngineMetric(dataset, {
      traceId: "trace-2",
      timestamp: 1_756_600_000_000,
      type: "performance",
      name: "rag",
      value: 12,
      status: "success",
      metadata: {},
    });

    const [dataPoint] = writeDataPoint.mock.calls[0];

    expect(dataPoint.indexes).toEqual(["rag"]);
    expect(dataPoint.doubles.slice(2)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(dataPoint.blobs[ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf("provider")]).toBe("unknown");
  });
});
