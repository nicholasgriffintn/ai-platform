import { describe, expect, it } from "vitest";

import { detectStreaming } from "../streaming";

describe("streaming", () => {
  describe("detectStreaming", () => {
    it("should detect streaming when body.stream is true", () => {
      const body = { stream: true, model: "gpt-4" };
      const endpoint = "/v1/chat/completions";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should not detect streaming when body.stream is false", () => {
      const body = { stream: false, model: "gpt-4" };
      const endpoint = "/v1/chat/completions";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should not detect streaming when body.stream is undefined", () => {
      const body = { model: "gpt-4" };
      const endpoint = "/v1/chat/completions";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should detect streaming when endpoint contains streamGenerateContent", () => {
      const body = { model: "gemini-pro" };
      const endpoint = "/v1/models/gemini-pro:streamGenerateContent";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should detect streaming when endpoint contains converse-stream", () => {
      const body = { model: "claude-3" };
      const endpoint = "/bedrock-runtime/converse-stream";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should detect streaming when both body.stream is true and endpoint is streaming", () => {
      const body = { stream: true, model: "gemini-pro" };
      const endpoint = "/v1/models/gemini-pro:streamGenerateContent";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should detect streaming when body.stream is false but endpoint is streaming", () => {
      const body = { stream: false, model: "gemini-pro" };
      const endpoint = "/v1/models/gemini-pro:streamGenerateContent";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should handle empty body", () => {
      const body = {};
      const endpoint = "/v1/chat/completions";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should handle empty endpoint", () => {
      const body = { stream: true };
      const endpoint = "";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should handle endpoint with partial matches", () => {
      const body = { model: "test" };
      const endpoint = "/v1/streamGenerate"; // Doesn't contain "streamGenerateContent"

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should handle endpoint with converse but not converse-stream", () => {
      const body = { model: "claude-3" };
      const endpoint = "/bedrock-runtime/converse";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should be case sensitive for endpoint matching", () => {
      const body = { model: "gemini-pro" };
      const endpoint = "/v1/models/gemini-pro:STREAMGENERATECONTENT";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should handle multiple streaming indicators in endpoint", () => {
      const body = { model: "test" };
      const endpoint = "/api/streamGenerateContent/converse-stream/test";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(true);
    });

    it("should handle body.stream with truthy but not boolean true", () => {
      const body = { stream: "true" as any };
      const endpoint = "/v1/chat/completions";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });

    it("should handle body.stream with falsy values", () => {
      const body = { stream: 0 as any };
      const endpoint = "/v1/chat/completions";

      const result = detectStreaming(body, endpoint);

      expect(result).toBe(false);
    });
  });
});
