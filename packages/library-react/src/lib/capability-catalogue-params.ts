import type { CatalogueItemKind } from "./project-capability-catalog.js";

export const CATALOGUE_PARAMS = {
  kind: "type",
  category: "category",
  query: "q",
  show: "show",
} as const;

const INSTALLED = "installed";
const ALL_CATEGORIES = "all";

export interface CatalogueFilters {
  kind: CatalogueItemKind | null;
  installed: boolean;
  category: string;
  query: string;
}

export type CatalogueParamsPatch = Partial<
  Record<(typeof CATALOGUE_PARAMS)[keyof typeof CATALOGUE_PARAMS], string | null>
>;

export function readCatalogueFilters(
  params: URLSearchParams,
  kinds: readonly CatalogueItemKind[],
): CatalogueFilters {
  const kind = params.get(CATALOGUE_PARAMS.kind);

  return {
    kind: kinds.find((candidate) => candidate === kind) ?? kinds[0] ?? null,
    installed: params.get(CATALOGUE_PARAMS.show) === INSTALLED,
    category: params.get(CATALOGUE_PARAMS.category) || ALL_CATEGORIES,
    query: params.get(CATALOGUE_PARAMS.query) ?? "",
  };
}

export function buildCatalogueParamsPatch(
  filters: Partial<CatalogueFilters>,
): CatalogueParamsPatch {
  const patch: CatalogueParamsPatch = {};

  if ("kind" in filters) {
    patch[CATALOGUE_PARAMS.kind] = filters.kind ?? null;
  }

  if ("installed" in filters) {
    patch[CATALOGUE_PARAMS.show] = filters.installed ? INSTALLED : null;
  }

  if ("category" in filters) {
    patch[CATALOGUE_PARAMS.category] =
      filters.category && filters.category !== ALL_CATEGORIES ? filters.category : null;
  }

  if ("query" in filters) {
    patch[CATALOGUE_PARAMS.query] = filters.query || null;
  }

  return patch;
}
