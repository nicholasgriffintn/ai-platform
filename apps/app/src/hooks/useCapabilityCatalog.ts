import { useQuery } from "@tanstack/react-query";

import { fetchCapabilityCatalog } from "~/lib/api/capabilities";

export const CAPABILITY_CATALOG_QUERY_KEY = ["capabilityCatalog"];

const CATALOG_STALE_TIME = 30 * 60 * 1000;
const CATALOG_GC_TIME = 60 * 60 * 1000;

export function useCapabilityCatalog() {
	return useQuery({
		queryKey: CAPABILITY_CATALOG_QUERY_KEY,
		queryFn: fetchCapabilityCatalog,
		staleTime: CATALOG_STALE_TIME,
		gcTime: CATALOG_GC_TIME,
	});
}
