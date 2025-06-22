import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseAIResponseJson } from "../json";

vi.mock("../logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

describe("json", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseAIResponseJson", () => {
    it("should parse valid JSON", () => {
      const response = '{"name": "John", "age": 30}';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.error).toBeNull();
    });

    it("should handle null response", () => {
      const result = parseAIResponseJson(null);

      expect(result.data).toBeNull();
      expect(result.error).toBe("Empty response");
    });

    it("should handle undefined response", () => {
      const result = parseAIResponseJson(undefined);

      expect(result.data).toBeNull();
      expect(result.error).toBe("Empty response");
    });

    it("should handle empty string response", () => {
      const result = parseAIResponseJson("");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Empty response");
    });

    it("should extract JSON from markdown code blocks", () => {
      const response = '```json\n{"name": "John", "age": 30}\n```';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.error).toBeNull();
    });

    it("should extract JSON from code blocks without language", () => {
      const response = '```\n{"name": "John", "age": 30}\n```';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.error).toBeNull();
    });

    it("should extract JSON object from mixed text", () => {
      const response =
        'Here is the result: {"name": "John", "age": 30} as requested.';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.error).toBeNull();
    });

    it("should extract JSON array from mixed text", () => {
      const response =
        'The results are: [{"name": "John"}, {"name": "Jane"}] from the data.';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual([{ name: "John" }, { name: "Jane" }]);
      expect(result.error).toBeNull();
    });

    it("should prefer object over array when both are present", () => {
      const response = 'Array: [1,2,3] and object: {"key": "value"} present.';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.error).toBeNull();
    });

    it("should handle invalid JSON with trailing comma", () => {
      const response = '{"name": "John", "age": 30,}';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.error).toBeNull();
    });

    it("should handle invalid JSON with single quotes", () => {
      const response = "{'name': 'John', 'age': 30}";

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.error).toBeNull();
    });

    it("should handle invalid JSON with array trailing comma", () => {
      const response = '[{"name": "John"}, {"name": "Jane"},]';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual([{ name: "John" }, { name: "Jane" }]);
      expect(result.error).toBeNull();
    });

    it("should return error for completely invalid JSON", () => {
      const response = "This is not JSON at all";

      const result = parseAIResponseJson(response);

      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.partialData).toBeTruthy();
    });

    it("should handle malformed JSON with partial data", () => {
      const response = '{"name": "John", "incomplete":';

      const result = parseAIResponseJson(response);

      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.partialData).toBeTruthy();
    });

    it("should handle empty object", () => {
      const response = "{}";

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({});
      expect(result.error).toBeNull();
    });

    it("should handle empty array", () => {
      const response = "[]";

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("should handle nested JSON objects", () => {
      const response =
        '{"user": {"name": "John", "details": {"age": 30, "city": "NYC"}}}';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({
        user: {
          name: "John",
          details: {
            age: 30,
            city: "NYC",
          },
        },
      });
      expect(result.error).toBeNull();
    });

    it("should handle JSON with special characters", () => {
      const response =
        '{"message": "Hello\\nWorld", "emoji": "😀", "unicode": "\\u0048\\u0065\\u006C\\u006C\\u006F"}';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({
        message: "Hello\nWorld",
        emoji: "😀",
        unicode: "Hello",
      });
      expect(result.error).toBeNull();
    });

    it("should handle JSON with boolean and null values", () => {
      const response = '{"active": true, "inactive": false, "empty": null}';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({
        active: true,
        inactive: false,
        empty: null,
      });
      expect(result.error).toBeNull();
    });

    it("should handle deeply nested code blocks", () => {
      const response =
        'Some text\n```json\n{\n  "nested": {\n    "data": "value"\n  }\n}\n```\nMore text';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({
        nested: {
          data: "value",
        },
      });
      expect(result.error).toBeNull();
    });

    it("should handle whitespace around JSON", () => {
      const response = '   \n  {"key": "value"}  \n   ';

      const result = parseAIResponseJson(response);

      expect(result.data).toEqual({ key: "value" });
      expect(result.error).toBeNull();
    });

    it("should handle circular reference error gracefully", () => {
      const response = '{"valid": "json"}';

      // Mock JSON.parse to throw a circular reference error
      const originalParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementation(() => {
        const obj: any = {};
        obj.circular = obj;
        return obj;
      });

      const result = parseAIResponseJson(response);

      expect(result.data).toBeTruthy();
      expect(result.error).toBeNull();

      // Restore original JSON.parse
      JSON.parse = originalParse;
    });
  });
});
