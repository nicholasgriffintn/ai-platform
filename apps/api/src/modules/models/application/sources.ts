import type { ModelBenchmarkStanding, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export interface ModelLookup {
  env?: IEnv;
  userId?: number;
  provider?: string;
}

export interface ModelSource {
  find(modelId: string, lookup: ModelLookup): Promise<ModelConfigItem | null>;
  findByMatchingModel?(matchingModel: string, lookup: ModelLookup): Promise<ModelConfigItem | null>;
  list?(env: IEnv, userId: number): Promise<Record<string, ModelConfigItem>>;
}

export type ModelStandingsLoader = (
  env: IEnv,
  userId?: number,
) => Promise<Map<string, ModelBenchmarkStanding[]>>;

const modelSources: ModelSource[] = [];
let modelStandingsLoader: ModelStandingsLoader | undefined;

export function registerModelSource(source: ModelSource): void {
  modelSources.push(source);
}

export function registerModelStandings(loader: ModelStandingsLoader): void {
  modelStandingsLoader = loader;
}

export async function findSourcedModel(
  modelId: string,
  lookup: ModelLookup,
): Promise<ModelConfigItem | null> {
  for (const source of modelSources) {
    const model = await source.find(modelId, lookup);

    if (model) {
      return model;
    }
  }

  return null;
}

export async function findSourcedModelByMatchingModel(
  matchingModel: string,
  lookup: ModelLookup,
): Promise<ModelConfigItem | null> {
  for (const source of modelSources) {
    const model = await source.findByMatchingModel?.(matchingModel, lookup);

    if (model) {
      return model;
    }
  }

  return null;
}

export async function listSourcedModels(
  env: IEnv,
  userId: number,
): Promise<Record<string, ModelConfigItem>> {
  const listed = await Promise.all(modelSources.map((source) => source.list?.(env, userId)));

  return Object.assign({}, ...listed.filter(Boolean));
}

export async function loadModelStandings(
  env: IEnv,
  userId?: number,
): Promise<Map<string, ModelBenchmarkStanding[]>> {
  return modelStandingsLoader ? modelStandingsLoader(env, userId) : new Map();
}
