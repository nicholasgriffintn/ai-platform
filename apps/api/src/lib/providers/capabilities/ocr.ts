import { DEFAULT_OCR_PROVIDER, type OcrProvider } from "@ngriffin_uk/polychat-ai-providers";

import { resolveModelProvider } from "~/services/models/resolve";
import type { IEnv } from "~/types";

import { providerLibrary } from "../library";
import type { ProviderFactoryContext } from "../registry/types";

export async function resolveOcrProviderName({
  env,
  model,
  provider,
}: {
  env?: IEnv;
  model?: string;
  provider?: string;
}): Promise<string> {
  return resolveModelProvider({
    env,
    model,
    provider,
    defaultProvider: DEFAULT_OCR_PROVIDER,
  });
}

export function getOcrProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): OcrProvider {
  return providerLibrary.resolve("ocr", providerName, context ?? {});
}
