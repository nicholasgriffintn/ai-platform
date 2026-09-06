import { useQuery } from "@tanstack/react-query";

import { fetchCapabilityCatalog, fetchPublicCapabilityCatalogue } from "~/lib/api/capabilities";

export const CAPABILITY_CATALOG_QUERY_KEY = ["capabilityCatalog"] as const;

export const PUBLIC_CAPABILITY_CATALOGUE_QUERY_KEY = ["publicCapabilityCatalogue"] as const;

export const capabilityCatalogQueryKey = (projectId?: string) =>
  [...CAPABILITY_CATALOG_QUERY_KEY, projectId ?? "personal"] as const;

const CATALOG_STALE_TIME = 30 * 60 * 1000;
const CATALOG_GC_TIME = 60 * 60 * 1000;

export function useCapabilityCatalog(projectId?: string) {
  return useQuery({
    queryKey: capabilityCatalogQueryKey(projectId),
    queryFn: () => fetchCapabilityCatalog(projectId),
    staleTime: CATALOG_STALE_TIME,
    gcTime: CATALOG_GC_TIME,
  });
}

export function usePublicCapabilityCatalogue() {
  return useQuery({
    queryKey: PUBLIC_CAPABILITY_CATALOGUE_QUERY_KEY,
    queryFn: fetchPublicCapabilityCatalogue,
    staleTime: CATALOG_STALE_TIME,
    gcTime: CATALOG_GC_TIME,
  });
}
