import { describe, expect, it } from "vitest";
import { TranscriptionProviderFactory } from "../factory";
import { MistralTranscriptionProvider } from "../mistral";
import { WorkersTranscriptionProvider } from "../workers";

describe("TranscriptionProviderFactory", () => {
  describe("getProvider", () => {
    it("should return workers provider for 'workers' key", () => {
      const provider = TranscriptionProviderFactory.getProvider("workers");
      expect(provider).toBeInstanceOf(WorkersTranscriptionProvider);
      expect(provider.name).toBe("workers");
    });

    it("should return mistral provider for 'mistral' key", () => {
      const provider = TranscriptionProviderFactory.getProvider("mistral");
      expect(provider).toBeInstanceOf(MistralTranscriptionProvider);
      expect(provider.name).toBe("mistral");
    });

    it("should return workers provider for unknown key (fallback)", () => {
      const provider = TranscriptionProviderFactory.getProvider("unknown");
      expect(provider).toBeInstanceOf(WorkersTranscriptionProvider);
      expect(provider.name).toBe("workers");
    });
  });

  describe("getProviders", () => {
    it("should return all available provider keys", () => {
      const providers = TranscriptionProviderFactory.getProviders();
      expect(providers).toEqual(expect.arrayContaining(["workers", "mistral"]));
      expect(providers).toHaveLength(2);
    });
  });
});
