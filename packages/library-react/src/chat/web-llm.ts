import type {
  ChatCompletionMessageParam,
  InitProgressCallback,
  MLCEngineInterface,
} from "@mlc-ai/web-llm";

import { SerialExecutor } from "../lib/serial-executor.js";

export class WebLLMService {
  private static instance: WebLLMService;
  private engine: MLCEngineInterface | null = null;
  private currentModel: string | null = null;
  private readonly operations = new SerialExecutor();

  private constructor() {}

  public static getInstance(): WebLLMService {
    if (!WebLLMService.instance) {
      WebLLMService.instance = new WebLLMService();
    }

    return WebLLMService.instance;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  init(model: string, progressCallback?: InitProgressCallback): Promise<void> {
    return this.operations.run(() => this.loadModel(model, progressCallback));
  }

  private async loadModel(model: string, progressCallback?: InitProgressCallback): Promise<void> {
    if (this.engine && this.currentModel === model) {
      return;
    }

    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModel = null;
    }

    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    this.engine = await CreateMLCEngine(model, { initProgressCallback: progressCallback });
    this.currentModel = model;
  }

  generate(
    model: string,
    messages: ChatCompletionMessageParam[],
    onProgress?: (text: string) => void,
  ): Promise<string> {
    return this.operations.run(async () => {
      await this.loadModel(model);
      if (!this.engine) {
        throw new Error("Engine not initialized");
      }

      const chunks = await this.engine.chat.completions.create({ messages, stream: true });
      let content = "";

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content ?? "";

        content += delta;
        if (delta) {
          onProgress?.(delta);
        }
      }

      return content;
    });
  }

  unload(): Promise<void> {
    return this.operations.run(async () => {
      if (this.engine) {
        await this.engine.unload();
      }

      this.engine = null;
      this.currentModel = null;
    });
  }
}

export async function isWebLLMModelCached(modelId: string): Promise<boolean> {
  try {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");

    return await hasModelInCache(modelId);
  } catch {
    return false;
  }
}

export async function pruneStaleWebLLMModels(
  keepModelId: string | null,
  candidateModelIds: readonly string[],
): Promise<string[]> {
  const removed: string[] = [];
  let cache: typeof import("@mlc-ai/web-llm");

  try {
    cache = await import("@mlc-ai/web-llm");
  } catch {
    return removed;
  }

  for (const modelId of candidateModelIds) {
    if (modelId === keepModelId) {
      continue;
    }

    try {
      if (await cache.hasModelInCache(modelId)) {
        await cache.deleteModelAllInfoInCache(modelId);
        removed.push(modelId);
      }
    } catch {
      continue;
    }
  }

  return removed;
}
