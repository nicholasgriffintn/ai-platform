import { describe, expect, it } from "vitest";

import { ResponseDisplayType } from "../types/functions";
import { formatToolErrorResponse, formatToolResponse } from "./tool-responses";

describe("Tool Response Utilities", () => {
  describe("formatToolResponse", () => {
    it("should format a weather tool response correctly", () => {
      const toolName = "get_weather";
      const content = "Weather in London: Cloudy";
      const data = {
        weather: [{ icon: "04d", description: "cloudy" }],
        main: {
          temp: 15,
          feels_like: 14,
          humidity: 70,
        },
        wind: {
          speed: 5,
        },
      };

      const result = formatToolResponse(toolName, content, data);

      expect(result.content).toBe(content);
      expect(result.data.responseType).toBe(ResponseDisplayType.TEMPLATE);
      expect(result.data.icon).toBe("cloud");
      expect(result.data.formattedName).toBe("Get Weather");
      expect(result.data.responseDisplay).toBeDefined();
      expect(result.data.responseDisplay.template).toContain(
        "weather-response",
      );
      expect(result.data.weather).toEqual(data.weather);
    });

    it("should format a search tool response correctly", () => {
      const toolName = "web_search";
      const content = "Search results for: AI";
      const data = {
        results: [
          {
            title: "AI News",
            url: "https://example.com/ai",
            snippet: "Latest AI news",
          },
        ],
      };

      const result = formatToolResponse(toolName, content, data);

      expect(result.content).toBe(content);
      expect(result.data.responseType).toBe(ResponseDisplayType.CUSTOM);
      expect(result.data.icon).toBe("search");
      expect(result.data.formattedName).toBe("Web Search");
      expect(result.data.responseDisplay).toBeDefined();
      expect(result.data.results).toEqual(data.results);
    });
  });

  describe("formatToolErrorResponse", () => {
    it("should format an error response correctly", () => {
      const toolName = "get_weather";
      const errorMessage = "API key is invalid";

      const result = formatToolErrorResponse(toolName, errorMessage);

      expect(result.content).toBe("Error: API key is invalid");
      expect(result.data.responseType).toBe(ResponseDisplayType.TEXT);
      expect(result.data.icon).toBe("alert-triangle");
      expect(result.data.formattedName).toBe("Get Weather");
      expect(result.data.responseDisplay).toBeDefined();
      expect(result.data.responseDisplay.template).toContain("error-response");
      expect(result.data.responseDisplay.fields).toContainEqual({
        key: "content",
        label: "Error",
      });
    });
  });
});
