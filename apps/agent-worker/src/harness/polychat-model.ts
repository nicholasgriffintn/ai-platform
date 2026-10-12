import type { Model, Provider } from "@earendil-works/pi-ai";
import {
  stream as streamOpenAICompletions,
  streamSimple as streamSimpleOpenAICompletions,
} from "@earendil-works/pi-ai/api/openai-completions";
import {
  Model as OpenCodeModel,
  Provider as OpenCodeProvider,
  type Plugin,
} from "@opencode/plugin";

export const POLYCHAT_PROVIDER_ID = "polychat";
export const POLYCHAT_MODEL_BASE_URL = "https://polychat-api/agents/model";
const MODEL_PORT_KEY = "delegated";
const OPENCODE_PROVIDER_PACKAGE = "@opencode/ai/providers/openai-compatible";
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;

export type ModelFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function polychatPiModel(modelId: string): Model<"openai-completions"> {
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: POLYCHAT_PROVIDER_ID,
    baseUrl: POLYCHAT_MODEL_BASE_URL,
    input: ["text"],
    reasoning: true,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  };
}

export function polychatPiProvider(
  currentModel: () => string | undefined,
  fetch: ModelFetch,
): Provider<"openai-completions"> {
  return {
    id: POLYCHAT_PROVIDER_ID,
    name: "Polychat",
    baseUrl: POLYCHAT_MODEL_BASE_URL,
    auth: {
      apiKey: {
        name: "Polychat",
        resolve: async () => ({ auth: { apiKey: MODEL_PORT_KEY }, source: "Polychat" }),
      },
    },
    getModels: () => {
      const model = currentModel();

      return model ? [polychatPiModel(model)] : [];
    },
    stream: (model, context, options) =>
      streamOpenAICompletions(model, context, { ...options, apiKey: MODEL_PORT_KEY, fetch }),
    streamSimple: (model, context, options) =>
      streamSimpleOpenAICompletions(model, context, {
        ...options,
        apiKey: MODEL_PORT_KEY,
        fetch,
      }),
  };
}

export function polychatOpenCodePlugin(params: {
  agent: string;
  currentModel: () => string | undefined;
  currentInstructions: () => string | undefined;
  headers: Record<string, string>;
}) {
  const { agent, currentModel, currentInstructions, headers } = params;
  const providerID = OpenCodeProvider.ID.make(POLYCHAT_PROVIDER_ID);
  const reloads = new Set<() => Promise<void>>();
  const plugin: Plugin.Plugin = {
    id: "polychat.models",
    async setup(context) {
      const transform = await context.provider.transform((editor) => {
        const model = currentModel();

        editor.add({
          info: {
            id: providerID,
            name: "Polychat",
            activation: "enabled",
            package: OPENCODE_PROVIDER_PACKAGE,
            settings: { baseURL: POLYCHAT_MODEL_BASE_URL },
          },
          models: model
            ? [
                {
                  ...OpenCodeModel.Info.default(providerID, OpenCodeModel.ID.make(model)),
                  package: OPENCODE_PROVIDER_PACKAGE,
                  headers,
                  limit: { context: DEFAULT_CONTEXT_WINDOW, output: DEFAULT_MAX_OUTPUT_TOKENS },
                },
              ]
            : [],
        });
      });
      const agentTransform = await context.agent.transform((editor) => {
        const instructions = currentInstructions();

        if (instructions) {
          editor.update(agent, (info) => {
            info.system = instructions;
          });
        }
      });
      const reload = async () => {
        await context.provider.reload();
        await context.agent.reload();
      };

      reloads.add(reload);

      return async () => {
        reloads.delete(reload);
        await agentTransform.dispose();
        await transform.dispose();
      };
    },
  };

  return {
    plugin,
    async refresh(): Promise<void> {
      await Promise.all([...reloads].map((reload) => reload()));
    },
  };
}
