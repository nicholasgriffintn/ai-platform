import { DEFAULT_OCR_MODEL } from "../capabilities/ocr/constants.js";
import {
  GREENPT_OCR_MODEL,
  GreenPtOcrProvider,
} from "../capabilities/ocr/providers/GreenPtOcrProvider.js";
import { MistralOcrProvider } from "../capabilities/ocr/providers/MistralOcrProvider.js";
import type { OcrProvider } from "../capabilities/ocr/types.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function ocrProviders(runtime: ProviderRuntime): AiProviderRegistration<OcrProvider>[] {
  return [
    {
      name: "mistral",
      create: () => new MistralOcrProvider(runtime),
      metadata: {
        vendor: "Mistral",
        categories: ["ocr"],
        models: [DEFAULT_OCR_MODEL, "mistral-ocr-4-1"],
        defaultModel: DEFAULT_OCR_MODEL,
      },
    },
    {
      name: "greenpt",
      create: () => new GreenPtOcrProvider(runtime),
      metadata: {
        vendor: "GreenPT",
        categories: ["ocr"],
        models: [GREENPT_OCR_MODEL],
        defaultModel: GREENPT_OCR_MODEL,
      },
    },
  ];
}

export function registerOcrProviders(registry: AiProviderRegistry, runtime: ProviderRuntime): void {
  for (const registration of ocrProviders(runtime)) {
    registry.register("ocr", registration);
  }
}
