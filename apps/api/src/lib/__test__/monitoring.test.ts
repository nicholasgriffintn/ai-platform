import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Monitoring,
  trackGuardrailViolation,
  trackModelRoutingMetrics,
  trackProviderMetrics,
  trackRagMetrics,
  trackUsageMetric,
} from "../monitoring";

const mockAnalyticsEngine = {
  writeDataPoint: vi.fn(),
};

describe("Monitoring", () => {
  let monitoring: Monitoring;

  beforeEach(() => {
    vi.clearAllMocks();
    monitoring = Monitoring.getInstance(mockAnalyticsEngine as any);
  });

  describe("getInstance", () => {
    it("should create singleton instance", () => {
      const instance1 = Monitoring.getInstance(mockAnalyticsEngine as any);
      const instance2 = Monitoring.getInstance(mockAnalyticsEngine as any);

      expect(instance1).toBe(instance2);
    });

    it("should throw error when analytics engine not provided", () => {
      Monitoring["instance"] = undefined as any;
      expect(() => Monitoring.getInstance()).toThrow(
        "Analytics Engine not configured",
      );
    });
  });

  describe("recordMetric", () => {
    it("should record valid metric with analytics engine", () => {
      const metric = {
        traceId: "test-trace-123",
        timestamp: Date.now(),
        type: "performance" as const,
        name: "test-metric",
        value: 100,
        metadata: { key: "value" },
        status: "success" as const,
      };

      monitoring.recordMetric(metric);

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
        blobs: [
          "performance",
          "test-metric",
          "success",
          "None",
          "test-trace-123",
          JSON.stringify({ key: "value" }),
        ],
        doubles: [100, metric.timestamp],
        indexes: ["test-trace-123"],
      });
    });

    it("should record metric with error", () => {
      const metric = {
        traceId: "test-trace-123",
        timestamp: Date.now(),
        type: "error" as const,
        name: "test-error",
        value: 0,
        metadata: { error: "test error" },
        status: "error" as const,
        error: "Test error message",
      };

      monitoring.recordMetric(metric);

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
        blobs: [
          "error",
          "test-error",
          "error",
          "Test error message",
          "test-trace-123",
          JSON.stringify({ error: "test error" }),
        ],
        doubles: [0, metric.timestamp],
        indexes: ["test-trace-123"],
      });
    });

    it("should not record invalid metric", () => {
      const invalidMetric = {
        traceId: 123,
        timestamp: "not-a-number",
        type: "invalid-type",
        name: null,
        value: "not-a-number",
        metadata: {},
        status: "success",
      } as any;

      monitoring.recordMetric(invalidMetric);

      expect(mockAnalyticsEngine.writeDataPoint).not.toHaveBeenCalled();
    });

    it("should handle analytics engine without writeDataPoint method", () => {
      const invalidEngine = {} as any;
      const monitoring = Monitoring.getInstance(invalidEngine);

      const metric = {
        traceId: "test-trace-123",
        timestamp: Date.now(),
        type: "performance" as const,
        name: "test-metric",
        value: 100,
        metadata: {},
        status: "success" as const,
      };

      expect(() => monitoring.recordMetric(metric)).not.toThrow();
    });

    it("should generate traceId when not provided", () => {
      const metricWithoutTraceId = {
        timestamp: Date.now(),
        type: "usage" as const,
        name: "test-metric",
        value: 1,
        metadata: { userId: 123 },
        status: "success" as const,
      } as any;

      monitoring.recordMetric(metricWithoutTraceId);

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
        blobs: [
          "usage",
          "test-metric",
          "success",
          "None",
          expect.any(String),
          JSON.stringify({ userId: 123 }),
        ],
        doubles: [1, metricWithoutTraceId.timestamp],
        indexes: [expect.any(String)],
      });
    });
  });
});

describe("trackUsageMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should track usage metric with user ID", () => {
    trackUsageMetric(123, "test-usage", mockAnalyticsEngine as any);

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
      blobs: [
        "usage",
        "test-usage",
        "success",
        "None",
        "123",
        JSON.stringify({ userId: 123 }),
      ],
      doubles: [1, expect.any(Number)],
      indexes: ["123"],
    });
  });

  it("should use default name when not provided", () => {
    trackUsageMetric(456, undefined, mockAnalyticsEngine as any);

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["user_usage"]),
      }),
    );
  });

  it("should generate traceId when userId is undefined", () => {
    trackUsageMetric(
      undefined as any,
      "test-usage",
      mockAnalyticsEngine as any,
    );

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
      blobs: [
        "usage",
        "test-usage",
        "success",
        "None",
        expect.any(String),
        JSON.stringify({ userId: undefined }),
      ],
      doubles: [1, expect.any(Number)],
      indexes: [expect.any(String)],
    });
  });
});

describe("trackProviderMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should track successful provider operation", async () => {
    const mockOperation = vi.fn().mockResolvedValue({
      usage: { input_tokens: 100, output_tokens: 50 },
      system_fingerprint: "test-fingerprint",
      log_id: "test-log-123",
    });

    const result = await trackProviderMetrics({
      provider: "openai",
      model: "gpt-4",
      operation: mockOperation,
      analyticsEngine: mockAnalyticsEngine as any,
      settings: { temperature: 0.7, max_tokens: 1000 },
      userId: 123,
      completion_id: "completion-123",
    });

    expect(result).toEqual({
      usage: { input_tokens: 100, output_tokens: 50 },
      system_fingerprint: "test-fingerprint",
      log_id: "test-log-123",
    });

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "performance",
          "ai_provider_response",
          "success",
        ]),
      }),
    );
  });

  it("should track failed provider operation", async () => {
    const mockError = new Error("Provider error");
    const mockOperation = vi.fn().mockRejectedValue(mockError);

    await expect(
      trackProviderMetrics({
        provider: "openai",
        model: "gpt-4",
        operation: mockOperation,
        analyticsEngine: mockAnalyticsEngine as any,
      }),
    ).rejects.toThrow("Provider error");

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "error",
          "ai_provider_response",
          "error",
        ]),
      }),
    );
  });
});

describe("trackGuardrailViolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - instance is private
    Monitoring["instance"] = new Monitoring(mockAnalyticsEngine as any);
  });

  it("should track guardrail violation", () => {
    trackGuardrailViolation(
      "prompt_injection",
      { score: 0.9, model: "gpt-4" },
      mockAnalyticsEngine,
    );

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
      blobs: [
        "guardrail",
        "guardrail_violation",
        "info",
        "None",
        expect.any(String),
        JSON.stringify({
          violationName: "prompt_injection",
          details: { score: 0.9, model: "gpt-4" },
          userId: undefined,
        }),
      ],
      doubles: [0, expect.any(Number)],
      indexes: [expect.any(String)],
    });
  });
});

describe("trackRagMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should track successful RAG operation", async () => {
    const mockOperation = vi.fn().mockResolvedValue({ result: "test result" });

    const result = await trackRagMetrics(
      mockOperation,
      mockAnalyticsEngine as any,
      { query: "test query" },
      123,
      "completion-123",
    );

    expect(result).toEqual({ result: "test result" });
    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["performance", "rag", "success"]),
      }),
    );
  });

  it("should track failed RAG operation", async () => {
    const mockError = new Error("RAG error");
    const mockOperation = vi.fn().mockRejectedValue(mockError);

    await expect(
      trackRagMetrics(
        mockOperation,
        mockAnalyticsEngine as any,
        { query: "test query" },
        123,
        "completion-123",
      ),
    ).rejects.toThrow("RAG error");

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["error", "rag", "error"]),
      }),
    );
  });
});

describe("trackModelRoutingMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should track successful model routing operation", async () => {
    const mockOperation = vi
      .fn()
      .mockResolvedValue({ model: "selected-model" });

    const result = await trackModelRoutingMetrics(
      mockOperation,
      mockAnalyticsEngine as any,
      { prompt: "test prompt" },
      123,
      "completion-123",
    );

    expect(result).toEqual({ model: "selected-model" });
    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "performance",
          "model_routing",
          "success",
        ]),
      }),
    );
  });

  it("should track failed model routing operation", async () => {
    const mockError = new Error("Routing error");
    const mockOperation = vi.fn().mockRejectedValue(mockError);

    await expect(
      trackModelRoutingMetrics(
        mockOperation,
        mockAnalyticsEngine as any,
        { prompt: "test prompt" },
        123,
        "completion-123",
      ),
    ).rejects.toThrow("Routing error");

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["error", "model_routing", "error"]),
      }),
    );
  });
});
