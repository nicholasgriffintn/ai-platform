import { describe, expect, it } from "vitest";
import type { IEnv } from "~/types";
import { AssistantError } from "~/utils/errors";
import { SearchProviderFactory } from "../factory";
import { SerperProvider } from "../serper";
import { TavilyProvider } from "../tavily";

describe("SearchProviderFactory", () => {
  const mockEnv: IEnv = {
    SERPER_API_KEY: "test-serper-key",
    TAVILY_API_KEY: "test-tavily-key",
  } as IEnv;

  describe("getProvider", () => {
    it("should create SerperProvider when provider is serper", () => {
      const provider = SearchProviderFactory.getProvider("serper", mockEnv);
      expect(provider).toBeInstanceOf(SerperProvider);
    });

    it("should create TavilyProvider when provider is tavily", () => {
      const provider = SearchProviderFactory.getProvider("tavily", mockEnv);
      expect(provider).toBeInstanceOf(TavilyProvider);
    });

    it("should throw error when serper provider is requested but API key is missing", () => {
      const envWithoutSerper = {
        ...mockEnv,
        SERPER_API_KEY: undefined,
      } as IEnv;

      expect(() =>
        SearchProviderFactory.getProvider("serper", envWithoutSerper),
      ).toThrow(expect.any(AssistantError));
      expect(() =>
        SearchProviderFactory.getProvider("serper", envWithoutSerper),
      ).toThrow("SERPER_API_KEY is not set");
    });

    it("should throw error when tavily provider is requested but API key is missing", () => {
      const envWithoutTavily = {
        ...mockEnv,
        TAVILY_API_KEY: undefined,
      } as IEnv;

      expect(() =>
        SearchProviderFactory.getProvider("tavily", envWithoutTavily),
      ).toThrow(expect.any(AssistantError));
      expect(() =>
        SearchProviderFactory.getProvider("tavily", envWithoutTavily),
      ).toThrow("TAVILY_API_KEY is not set");
    });

    it("should throw error for unknown provider", () => {
      expect(() =>
        SearchProviderFactory.getProvider("unknown" as any, mockEnv),
      ).toThrow(expect.any(AssistantError));
      expect(() =>
        SearchProviderFactory.getProvider("unknown" as any, mockEnv),
      ).toThrow("Unknown search provider: unknown");
    });
  });
});
