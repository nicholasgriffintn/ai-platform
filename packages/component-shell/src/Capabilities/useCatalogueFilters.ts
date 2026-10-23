import {
  buildCatalogueParamsPatch,
  type CatalogueFilters,
  type CatalogueItemKind,
  readCatalogueFilters,
} from "@ngriffin_uk/polychat-library-react";

import { useSearchParamsPatch } from "../utils/useSearchParamsPatch.js";

export function useCatalogueFilters(kinds: readonly CatalogueItemKind[]) {
  const [searchParams, patch] = useSearchParamsPatch();
  const filters = readCatalogueFilters(searchParams, kinds);
  const navigate = (next: Partial<CatalogueFilters>) =>
    patch(buildCatalogueParamsPatch(next), { replace: false });

  return {
    ...filters,
    setKind: (kind: CatalogueItemKind) => navigate({ kind, installed: false, category: "all" }),
    setInstalled: (installed: boolean) => navigate({ installed, category: "all" }),
    setCategory: (category: string) => navigate({ category }),
    setQuery: (query: string) => patch(buildCatalogueParamsPatch({ query })),
  };
}
