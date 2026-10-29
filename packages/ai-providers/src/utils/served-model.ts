import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

const servedModelListSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) })),
});

const servedModels = new Map<string, Promise<string>>();

async function fetchServedModel(
  modelsUrl: string,
  headers: Record<string, string>,
  provider: string,
  setting: string,
): Promise<string> {
  const response = await fetch(modelsUrl, { headers });

  if (!response.ok) {
    throw new AssistantError(
      `${provider} did not list its models (${response.status}). Set ${setting} to the model it serves.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const parsed = servedModelListSchema.safeParse(await response.json().catch(() => null));
  const ids = parsed.success ? parsed.data.data.map((model) => model.id) : [];
  const [id] = ids;

  if (ids.length !== 1 || !id) {
    throw new AssistantError(
      ids.length
        ? `${provider} serves ${ids.join(", ")}. Set ${setting} to the one to use.`
        : `${provider} lists no models. Set ${setting} to the model it serves.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return id;
}

export function readServedModel(
  modelsUrl: string,
  headers: Record<string, string>,
  provider: string,
  setting: string,
): Promise<string> {
  const cached = servedModels.get(modelsUrl);

  if (cached) {
    return cached;
  }

  const pending = fetchServedModel(modelsUrl, headers, provider, setting).catch((error) => {
    servedModels.delete(modelsUrl);
    throw error;
  });

  servedModels.set(modelsUrl, pending);

  return pending;
}
