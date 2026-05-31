import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import { DEFAULT_OCR_MODEL } from "../../capabilities/ocr/constants";
import type { OcrProvider } from "../../capabilities/ocr/types";
import { MistralOcrProvider } from "../../capabilities/ocr/providers/MistralOcrProvider";

const ocrProviders: ProviderRegistration<OcrProvider>[] = [
	{
		name: "mistral",
		create: () => new MistralOcrProvider(),
		metadata: {
			vendor: "Mistral",
			categories: ["ocr"],
			models: [DEFAULT_OCR_MODEL],
			defaultModel: DEFAULT_OCR_MODEL,
		},
	},
];

export function registerOcrProviders(registry: ProviderRegistry): void {
	for (const registration of ocrProviders) {
		registry.register("ocr", registration);
	}
}
