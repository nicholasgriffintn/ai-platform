import type { IEnv } from "~/types";

import { providerLibrary } from "../../library";
import { resolveModelProvider } from "../../models";
import type { ProviderFactoryContext } from "../../registry/types";
import { DEFAULT_OCR_PROVIDER } from "./constants";
import type { OcrProvider } from "./types";

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
  return providerLibrary.ocr(providerName, context);
}
