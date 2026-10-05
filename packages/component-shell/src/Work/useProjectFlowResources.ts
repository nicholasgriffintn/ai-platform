import { getNativeRecordTable } from "@ngriffin_uk/polychat-library-client";
import { useNativeRecordTables } from "@ngriffin_uk/polychat-library-react";
import type { ProjectFlow } from "@ngriffin_uk/polychat-schemas";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";

export function useProjectFlowResources(
  projectId: string,
  flow: ProjectFlow | null,
  enabled: boolean,
) {
  const catalogue = useNativeRecordTables(projectId, enabled);
  const [requested, setRequested] = useState<{ projectId: string; tableIds: string[] }>({
    projectId,
    tableIds: [],
  });
  const flowTables =
    flow?.nodes.flatMap((node) =>
      node.type === "function" && node.operation.kind !== "set_values"
        ? [node.operation.tableId]
        : [],
    ) ?? [];
  const tableIds = [
    ...new Set([
      ...flowTables,
      ...(flow?.recordTriggers.map((trigger) => trigger.tableId) ?? []),
      ...(requested.projectId === projectId ? requested.tableIds : []),
    ]),
  ].filter(Boolean);
  const definitions = useQueries({
    queries: tableIds.map((tableId) => ({
      queryKey: ["native-records", "table", tableId],
      queryFn: () => getNativeRecordTable(tableId),
      enabled,
      staleTime: 15_000,
    })),
  });
  const eligible = definitions.flatMap((query) =>
    query.data &&
    !query.isError &&
    query.data.output.projectId === projectId &&
    query.data.definition.visibility === "shared"
      ? [
          {
            id: query.data.output.id,
            title: query.data.output.title,
            columns: query.data.definition.columns,
          },
        ]
      : [],
  );
  const options = new Map(
    (catalogue.data?.pages.flatMap((page) => page) ?? []).map((table) => [
      table.id,
      { id: table.id, title: table.title },
    ]),
  );

  for (const table of eligible) {
    options.set(table.id, { id: table.id, title: table.title });
  }

  const unavailable = definitions.some(
    (query) =>
      query.data &&
      (query.data.output.projectId !== projectId || query.data.definition.visibility !== "shared"),
  );

  return {
    recordTables: [...options.values()],
    recordDefinitions: eligible,
    resourcesError:
      catalogue.error?.message ??
      definitions.find((query) => query.error)?.error?.message ??
      (unavailable
        ? "Flows require shared tables from this project. Choose a different table."
        : undefined),
    hasMoreTables: catalogue.hasNextPage,
    isLoadingTables: catalogue.isFetchingNextPage,
    onLoadMoreTables: () => {
      void catalogue.fetchNextPage();
    },
    onSelectTable: (tableId: string) => {
      if (!tableId) {
        return;
      }

      setRequested((current) => ({
        projectId,
        tableIds: [
          ...new Set([...(current.projectId === projectId ? current.tableIds : []), tableId]),
        ],
      }));
    },
  };
}
