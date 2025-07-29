import type { TranscriptionProvider } from "./base";
import { MistralTranscriptionProvider } from "./mistral";
import { WorkersTranscriptionProvider } from "./workers";

// biome-ignore lint/complexity/noStaticOnlyClass: I prefer this pattern
export class TranscriptionProviderFactory {
  private static providers: Record<string, TranscriptionProvider> = {
    workers: new WorkersTranscriptionProvider(),
    mistral: new MistralTranscriptionProvider(),
  };

  static getProvider(providerName: string): TranscriptionProvider {
    return (
      TranscriptionProviderFactory.providers[providerName] ||
      TranscriptionProviderFactory.providers.workers
    );
  }

  static getProviders(): string[] {
    return Object.keys(TranscriptionProviderFactory.providers);
  }
}
