import { DEFAULT_OCR_MODEL } from "../../capabilities/ocr/constants";
import { MistralOcrProvider } from "../../capabilities/ocr/providers/MistralOcrProvider";
import type { OcrProvider } from "../../capabilities/ocr/types";
import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";

const ocrProviders: ProviderRegistration<OcrProvider>[] = [
  {
    name: "mistral",
    create: () => new MistralOcrProvider(),
    metadata: {
      vendor: "Mistral",
      categories: ["ocr"],
      models: [DEFAULT_OCR_MODEL, "mistral-ocr-4-1"],
      defaultModel: DEFAULT_OCR_MODEL,
    },
  },
];

export function registerOcrProviders(registry: ProviderRegistry): void {
  for (const registration of ocrProviders) {
    registry.register("ocr", registration);
  }
}
