import { describe, expect, it, vi } from "vitest";

import {
  createAnalyticsEngineSink,
  writeAnalyticsEngineMetric,
} from "../sinks/analytics-engine.js";
import {
  ANALYTICS_ENGINE_BLOB_COLUMNS,
  ANALYTICS_ENGINE_DOUBLE_COLUMNS,
} from "../sinks/dataset-layout.js";

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
      name: "chat_run_approval_latency",
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

    expect(dataPoint.indexes).toEqual(["chat_run_approval_latency"]);
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

describe("analytics engine AI event projection", () => {
  it("projects $ai_generation properties into the fixed columns", () => {
    const { writeDataPoint, dataset } = captureDataPoint();
    const sink = createAnalyticsEngineSink({ ANALYTICS: dataset }, () => 1_756_600_000_000);

    sink?.capture?.({
      name: "$ai_generation",
      category: "ai_observability",
      distinctId: "user:1",
      properties: {
        $ai_trace_id: "trace-1",
        $ai_provider: "anthropic",
        $ai_model: "claude-sonnet-5",
        $ai_latency: 0.812,
        $ai_input_tokens: 1000,
        $ai_output_tokens: 500,
        $ai_cache_read_input_tokens: 200,
        $ai_cache_creation_input_tokens: 50,
        $ai_reasoning_tokens: 25,
        $ai_is_error: false,
      },
    });

    const [dataPoint] = writeDataPoint.mock.calls[0];
    const blobAt = (column: (typeof ANALYTICS_ENGINE_BLOB_COLUMNS)[number]) =>
      dataPoint.blobs[ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf(column)];
    const doubleAt = (column: (typeof ANALYTICS_ENGINE_DOUBLE_COLUMNS)[number]) =>
      dataPoint.doubles[ANALYTICS_ENGINE_DOUBLE_COLUMNS.indexOf(column)];

    expect(dataPoint.indexes).toEqual(["$ai_generation"]);
    expect(blobAt("traceId")).toBe("trace-1");
    expect(blobAt("provider")).toBe("anthropic");
    expect(blobAt("model")).toBe("claude-sonnet-5");
    expect(blobAt("status")).toBe("success");
    expect(doubleAt("latencyMs")).toBeCloseTo(812);
    expect(doubleAt("inputTokens")).toBe(1000);
    expect(doubleAt("outputTokens")).toBe(500);
    expect(doubleAt("totalTokens")).toBe(1500);
    expect(doubleAt("cachedInputTokens")).toBe(200);
    expect(doubleAt("cacheCreationTokens")).toBe(50);
    expect(doubleAt("reasoningTokens")).toBe(25);
  });

  it("marks failed $ai_embedding events as errors with the failure message", () => {
    const { writeDataPoint, dataset } = captureDataPoint();
    const sink = createAnalyticsEngineSink({ ANALYTICS: dataset }, () => 1_756_600_000_000);

    sink?.capture?.({
      name: "$ai_embedding",
      category: "ai_observability",
      distinctId: "user:1",
      properties: {
        $ai_trace_id: "trace-2",
        $ai_provider: "workers-ai",
        $ai_model: "@cf/baai/bge-large-en-v1.5",
        $ai_is_error: true,
        $ai_error: "embedding model unavailable",
      },
    });

    const [dataPoint] = writeDataPoint.mock.calls[0];

    expect(dataPoint.blobs[ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf("status")]).toBe("error");
    expect(dataPoint.blobs[ANALYTICS_ENGINE_BLOB_COLUMNS.indexOf("error")]).toBe(
      "embedding model unavailable",
    );
  });
});
