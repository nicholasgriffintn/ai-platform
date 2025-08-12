import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatCompletionParameters } from "~/types";
import {
  calculateReasoningBudget,
  createCommonParameters,
  getEffectiveMaxTokens,
  getToolsForProvider,
  mergeParametersWithDefaults,
  shouldEnableStreaming,
  isNovaModel,
} from "../parameters";

vi.mock("~/services/functions", () => ({
  availableFunctions: [
    { name: "web_search", description: "Search the web" },
    { name: "get_weather", description: "Get weather info" },
    { name: "create_image", description: "Generate an image" },
  ],
}));

vi.mock("../../lib/chat/tools", () => ({
  formatToolCalls: vi.fn((_provider, functions) =>
    functions.map((func: any) => ({ type: "function", function: func })),
  ),
}));

describe("parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEffectiveMaxTokens", () => {
    it("should return requested tokens when within model limit", () => {
      const result = getEffectiveMaxTokens(1000, 2000);
      expect(result).toBe(1000);
    });

    it("should return model limit when requested exceeds limit", () => {
      const result = getEffectiveMaxTokens(3000, 2000);
      expect(result).toBe(2000);
    });

    it("should use default when no requested tokens provided", () => {
      const result = getEffectiveMaxTokens(undefined, 2000);
      expect(result).toBe(2000);
    });

    it("should use default when no model limit provided", () => {
      const result = getEffectiveMaxTokens(1000, undefined);
      expect(result).toBe(1000);
    });

    it("should use default for both when neither provided", () => {
      const result = getEffectiveMaxTokens(undefined, undefined);
      expect(result).toBe(4096); // default
    });

    it("should handle zero values", () => {
      const result = getEffectiveMaxTokens(0, 1000);
      expect(result).toBe(1000);
    });
  });

  describe("mergeParametersWithDefaults", () => {
    it("should merge basic parameters", () => {
      const params = { model: "gpt-4", temperature: 0.7 };
      const defaults = { temperature: 0.5, max_tokens: 1000 };

      const result = mergeParametersWithDefaults(params, defaults);

      expect(result).toEqual({
        model: "gpt-4",
        temperature: 0.7, // params override defaults
        max_tokens: 1000,
        rag_options: {},
      });
    });

    it("should merge rag_options deeply", () => {
      const params = {
        rag_options: { enabled: true, top_k: 5 },
      };
      const defaults = {
        rag_options: { enabled: false, top_k: 10, similarity_threshold: 0.8 },
      };

      // @ts-expect-error - rag_options is not a valid parameter
      const result = mergeParametersWithDefaults(params, defaults);

      expect(result.rag_options).toEqual({
        enabled: true, // overridden
        top_k: 5, // overridden
        similarity_threshold: 0.8, // from defaults
      });
    });

    it("should handle empty defaults", () => {
      const params = { model: "gpt-4", temperature: 0.7 };

      const result = mergeParametersWithDefaults(params, {});

      expect(result).toEqual({
        model: "gpt-4",
        temperature: 0.7,
        rag_options: {},
      });
    });

    it("should handle undefined defaults", () => {
      const params = { model: "gpt-4", temperature: 0.7 };

      const result = mergeParametersWithDefaults(params);

      expect(result).toEqual({
        model: "gpt-4",
        temperature: 0.7,
        rag_options: {},
      });
    });

    it("should handle nested rag_options", () => {
      const params = {
        model: "gpt-4",
        rag_options: { retrieval: { max_documents: 5 } },
      };
      const defaults = {
        rag_options: {
          enabled: true,
          retrieval: { max_documents: 10, similarity_threshold: 0.8 },
        },
      };

      // @ts-expect-error - rag_options is not a valid parameter
      const result = mergeParametersWithDefaults(params, defaults);

      expect(result.rag_options).toEqual({
        enabled: true,
        retrieval: { max_documents: 5 },
      });
    });
  });

  describe("calculateReasoningBudget", () => {
    it("should calculate budget for low reasoning effort", () => {
      const params = {
        reasoning_effort: "low",
        max_tokens: 2000,
      } as ChatCompletionParameters;

      const result = calculateReasoningBudget(params);

      expect(result).toBe(1024); // Math.max(Math.floor(2000 * 0.5), 1024)
    });

    it("should calculate budget for medium reasoning effort", () => {
      const params = {
        reasoning_effort: "medium",
        max_tokens: 2000,
      } as ChatCompletionParameters;

      const result = calculateReasoningBudget(params);

      expect(result).toBe(1500); // Math.floor(2000 * 0.75)
    });

    it("should calculate budget for high reasoning effort", () => {
      const params = {
        reasoning_effort: "high",
        max_tokens: 2000,
      } as ChatCompletionParameters;

      const result = calculateReasoningBudget(params);

      expect(result).toBe(1800); // Math.floor(2000 * 0.9)
    });

    it("should use default (medium) for undefined reasoning effort", () => {
      const params = { max_tokens: 2000 } as ChatCompletionParameters;

      const result = calculateReasoningBudget(params);

      expect(result).toBe(1500); // Default to medium
    });

    it("should respect minimum budget of 1024", () => {
      const params = {
        reasoning_effort: "low",
        max_tokens: 1000,
      } as ChatCompletionParameters;

      const result = calculateReasoningBudget(params);

      expect(result).toBe(1024); // Math.max(500, 1024)
    });

    it("should use model config max tokens", () => {
      const params = {
        reasoning_effort: "medium",
        max_tokens: 5000,
      } as ChatCompletionParameters;
      const modelConfig = { maxTokens: 2000 };

      const result = calculateReasoningBudget(params, modelConfig);

      expect(result).toBe(1500); // Based on effective max tokens (2000)
    });

    it("should use default when max_tokens is 0", () => {
      const params = {
        reasoning_effort: "medium",
        max_tokens: 0,
      } as ChatCompletionParameters;

      const result = calculateReasoningBudget(params);

      expect(result).toBe(3072);
    });

    it("should return 1024 when effective max tokens is actually 0", () => {
      const params = {
        reasoning_effort: "medium",
        max_tokens: 1000,
      } as ChatCompletionParameters;
      const modelConfig = { maxTokens: 0 };

      const result = calculateReasoningBudget(params, modelConfig);

      expect(result).toBe(1024);
    });
  });

  describe("createCommonParameters", () => {
    const baseParams = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.7,
      max_tokens: 1000,
    } as ChatCompletionParameters;

    const modelConfig = {
      maxTokens: 2000,
      supportsResponseFormat: true,
    };

    it("should create basic common parameters", () => {
      const result = createCommonParameters(baseParams, modelConfig, "openai");

      expect(result).toEqual({
        model: "gpt-4",
        messages: baseParams.messages,
        temperature: 0.7,
        max_completion_tokens: 1000,
        seed: undefined,
        repetition_penalty: undefined,
        frequency_penalty: undefined,
        presence_penalty: undefined,
        metadata: undefined,
        top_p: undefined,
      });
    });

    it("should format model name for OpenAI compatible providers", () => {
      const result = createCommonParameters(
        baseParams,
        modelConfig,
        "groq",
        true,
      );

      expect(result.model).toBe("groq/gpt-4");
    });

    it("should use max_tokens for non-OpenAI providers", () => {
      const result = createCommonParameters(
        baseParams,
        modelConfig,
        "anthropic",
      );

      expect(result.max_tokens).toBe(1000);
      expect(result.max_completion_tokens).toBeUndefined();
    });

    it("should exclude certain parameters for Anthropic", () => {
      const paramsWithAll = {
        ...baseParams,
        seed: 123,
        repetition_penalty: 1.1,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        metadata: { userId: "123" },
      } as ChatCompletionParameters;

      const result = createCommonParameters(
        paramsWithAll,
        modelConfig,
        "anthropic",
      );

      expect(result.seed).toBeUndefined();
      expect(result.repetition_penalty).toBeUndefined();
      expect(result.frequency_penalty).toBeUndefined();
      expect(result.presence_penalty).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it("should include parameters for non-Anthropic providers", () => {
      const paramsWithAll = {
        ...baseParams,
        seed: 123,
        repetition_penalty: 1.1,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        metadata: { userId: "123" },
      } as ChatCompletionParameters;

      const result = createCommonParameters(
        paramsWithAll,
        modelConfig,
        "openai",
      );

      expect(result.seed).toBe(123);
      expect(result.repetition_penalty).toBe(1.1);
      expect(result.frequency_penalty).toBe(0.1);
      expect(result.presence_penalty).toBe(0.1);
      expect(result.metadata).toEqual({ userId: "123" });
    });

    it("should include response_format when supported", () => {
      const paramsWithFormat = {
        ...baseParams,
        response_format: { type: "json_object" },
      } as ChatCompletionParameters;

      const result = createCommonParameters(
        paramsWithFormat,
        modelConfig,
        "openai",
      );

      expect(result.response_format).toEqual({ type: "json_object" });
    });

    it("should exclude response_format when not supported", () => {
      const paramsWithFormat = {
        ...baseParams,
        response_format: { type: "json_object" },
      } as ChatCompletionParameters;
      const configWithoutFormat = {
        ...modelConfig,
        supportsResponseFormat: false,
      };

      const result = createCommonParameters(
        paramsWithFormat,
        configWithoutFormat,
        "openai",
      );

      expect(result.response_format).toBeUndefined();
    });

    it("should include top_p when not in thinking mode", () => {
      const paramsWithTopP = {
        ...baseParams,
        top_p: 0.9,
        should_think: false,
      } as ChatCompletionParameters;

      const result = createCommonParameters(
        paramsWithTopP,
        modelConfig,
        "openai",
      );

      expect(result.top_p).toBe(0.9);
    });

    it("should exclude top_p when in thinking mode", () => {
      const paramsWithTopP = {
        ...baseParams,
        top_p: 0.9,
        should_think: true,
      } as ChatCompletionParameters;

      const result = createCommonParameters(
        paramsWithTopP,
        modelConfig,
        "openai",
      );

      expect(result.top_p).toBeUndefined();
    });

    it("should include version when provided", () => {
      const paramsWithVersion = {
        ...baseParams,
        version: "2024-01-01",
      } as ChatCompletionParameters;

      const result = createCommonParameters(
        paramsWithVersion,
        modelConfig,
        "anthropic",
      );

      expect(result.version).toBe("2024-01-01");
    });
  });

  describe("getToolsForProvider", () => {
    const baseParams = {
      model: "gpt-4",
      enabled_tools: ["web_search", "get_weather"],
    } as ChatCompletionParameters;

    const modelConfig = {
      supportsToolCalls: true,
      supportsSearchGrounding: true,
    };

    it("should return empty object when no model", () => {
      const params = { ...baseParams, model: "" } as ChatCompletionParameters;

      const result = getToolsForProvider(params, modelConfig, "openai");

      expect(result).toEqual({});
    });

    it("should return empty object when functions disabled", () => {
      const params = {
        ...baseParams,
        disable_functions: true,
      } as ChatCompletionParameters;

      const result = getToolsForProvider(params, modelConfig, "openai");

      expect(result).toEqual({});
    });

    it("should return empty object when response format is set", () => {
      const params = {
        ...baseParams,
        response_format: { type: "json_object" },
      } as ChatCompletionParameters;

      const result = getToolsForProvider(params, modelConfig, "openai");

      expect(result).toEqual({});
    });

    it("should return empty object when model doesn't support functions", () => {
      const configWithoutFunctions = {
        ...modelConfig,
        supportsToolCalls: false,
      };

      const result = getToolsForProvider(
        baseParams,
        configWithoutFunctions,
        "openai",
      );

      expect(result).toEqual({});
    });

    it("should format tools from enabled functions", async () => {
      const { formatToolCalls } = await import("../../lib/chat/tools");

      const result = getToolsForProvider(baseParams, modelConfig, "openai");

      expect(formatToolCalls).toHaveBeenCalled();
      expect(result.tools).toBeDefined();
      expect(result.tool_choice).toBeUndefined();
      expect(result.parallel_tool_calls).toBeUndefined();
    });

    it("should include provided tools along with enabled functions", () => {
      const paramsWithTools = {
        ...baseParams,
        tools: [{ type: "function", function: { name: "custom_tool" } }],
      } as ChatCompletionParameters;

      const result = getToolsForProvider(
        paramsWithTools,
        modelConfig,
        "openai",
      );

      expect(result.tools).toBeDefined();
    });

    it("should set parallel_tool_calls for supported models", () => {
      const paramsWithParallel = {
        ...baseParams,
        parallel_tool_calls: true,
      } as ChatCompletionParameters;

      const result = getToolsForProvider(
        paramsWithParallel,
        modelConfig,
        "openai",
      );

      expect(result.parallel_tool_calls).toBe(true);
    });

    it("should not set parallel_tool_calls for o1 models", () => {
      const paramsWithO1 = {
        ...baseParams,
        model: "o1",
        parallel_tool_calls: true,
      } as ChatCompletionParameters;

      const result = getToolsForProvider(paramsWithO1, modelConfig, "openai");

      expect(result.parallel_tool_calls).toBeUndefined();
    });

    it("should not set parallel_tool_calls for o3 models", () => {
      const paramsWithO3 = {
        ...baseParams,
        model: "o3",
        parallel_tool_calls: true,
      } as ChatCompletionParameters;

      const result = getToolsForProvider(paramsWithO3, modelConfig, "openai");

      expect(result.parallel_tool_calls).toBeUndefined();
    });

    it("should set tool_choice when provided", () => {
      const paramsWithChoice = {
        ...baseParams,
        tool_choice: "auto",
      } as ChatCompletionParameters;

      const result = getToolsForProvider(
        paramsWithChoice,
        modelConfig,
        "openai",
      );

      expect(result.tool_choice).toBe("auto");
    });

    it("should throw error when formatToolCalls fails", async () => {
      const { formatToolCalls } = await import("../../lib/chat/tools");
      vi.mocked(formatToolCalls).mockImplementation(() => {
        throw new Error("Format error");
      });

      expect(() => {
        getToolsForProvider(baseParams, modelConfig, "openai");
      }).toThrow("Failed to format tool calls: Format error");
    });
  });

  describe("shouldEnableStreaming", () => {
    it("should enable streaming for text models", () => {
      const modelConfig = { type: ["text"] };

      const result = shouldEnableStreaming(modelConfig, true, true);

      expect(result).toBe(true);
    });

    it("should enable streaming for coding models", () => {
      const modelConfig = { type: ["coding"] };

      const result = shouldEnableStreaming(modelConfig, true, true);

      expect(result).toBe(true);
    });

    it("should not enable streaming when not requested", () => {
      const modelConfig = { type: ["text"] };

      const result = shouldEnableStreaming(modelConfig, true, false);

      expect(result).toBe(false);
    });

    it("should not enable streaming when provider doesn't support it", () => {
      const modelConfig = { type: ["text"] };

      const result = shouldEnableStreaming(modelConfig, false, true);

      expect(result).toBe(false);
    });

    it("should not enable streaming for unsupported model types", () => {
      const modelConfig = { type: ["image"] };

      const result = shouldEnableStreaming(modelConfig, true, true);

      expect(result).toBe(false);
    });

    it("should handle missing model type", () => {
      const modelConfig = {};

      const result = shouldEnableStreaming(modelConfig, true, true);

      expect(result).toBe(false);
    });

    it("should handle null model type", () => {
      const modelConfig = { type: null };

      const result = shouldEnableStreaming(modelConfig, true, true);

      expect(result).toBe(false);
    });

    it("should handle mixed model types", () => {
      const modelConfig = { type: ["text", "image"] };

      const result = shouldEnableStreaming(modelConfig, true, true);

      expect(result).toBe(true); // Contains text type
    });
  });

  describe("isNovaModel", () => {
    it("should return true for nova-lite", () => {
      const result = isNovaModel("nova-lite");
      expect(result).toBe(true);
    });

    it("should return true for amazon.nova-lite-v1:0", () => {
      const result = isNovaModel("amazon.nova-lite-v1:0");
      expect(result).toBe(true);
    });

    it("should return false for non-nova models", () => {
      const result = isNovaModel("gpt-4");
      expect(result).toBe(false);
    });

    it("should return false for null model", () => {
      const result = isNovaModel(null);
      expect(result).toBe(false);
    });

    it("should return false for undefined model", () => {
      const result = isNovaModel(undefined);
      expect(result).toBe(false);
    });
  });
});
