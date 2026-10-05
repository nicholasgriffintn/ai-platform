import { executeSiteRecordOperation } from "@ngriffin_uk/polychat-library-client";
import type { SiteRecordOperation } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useSiteRecordOperations(siteId: string | null) {
  const client = useQueryClient();

  return useCallback(
    async (operation: SiteRecordOperation) => {
      if (!siteId) {
        throw new Error("Save the Site before using its records");
      }

      const result = await executeSiteRecordOperation(siteId, operation);

      if (result.operation !== "query") {
        await client.invalidateQueries({
          queryKey: ["native-records", "rows", result.record.tableId],
        });
      }

      return result;
    },
    [client, siteId],
  );
}
