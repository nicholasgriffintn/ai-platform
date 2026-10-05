import {
  createNativeRecordTable,
  getNativeRecordTable,
  updateNativeRecordTable,
  listNativeRecords,
  listNativeRecordChanges,
  createNativeRecord,
  updateNativeRecord,
  deleteNativeRecord,
  listOutputs,
} from "@ngriffin_uk/polychat-library-client";
import {
  nativeRecordQuerySchema,
  type CreateNativeRecordTableInput,
  type UpdateNativeRecordTableInput,
  type CreateNativeRecordInput,
  type UpdateNativeRecordInput,
  type DeleteNativeRecordInput,
  type NativeRecordQuery,
  type NativeRecordChange,
} from "@ngriffin_uk/polychat-schemas";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { OUTPUT_QUERY_KEYS } from "./useOutputs.js";

export function useCreateNativeRecordTable() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateNativeRecordTableInput) => createNativeRecordTable(input),
    onSettled: () => client.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all }),
  });
}

export function useNativeRecordTables(projectId?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["outputs", "record-tables", projectId],
    queryFn: ({ pageParam }) =>
      listOutputs({ projectId, kind: "records", limit: 100, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (page, _pages, offset) =>
      page.length === 100 ? offset + page.length : undefined,
    enabled,
  });
}

export function useNativeRecordTable(tableId: string | null) {
  return useQuery({
    queryKey: ["native-records", "table", tableId],
    queryFn: () =>
      tableId ? getNativeRecordTable(tableId) : Promise.reject(new Error("No table selected")),
    enabled: Boolean(tableId),
    refetchInterval: 15_000,
  });
}

export function useNativeRecords(
  tableId: string,
  query?: Pick<NativeRecordQuery, "filters" | "sort">,
) {
  const client = useQueryClient();
  const tableKey = ["native-records", "table", tableId];
  const rowKey = ["native-records", "rows", tableId];
  const table = useNativeRecordTable(tableId);
  const rows = useInfiniteQuery({
    queryKey: [
      ...rowKey,
      table.data?.output.revision,
      table.data?.permissions.actorUserId,
      table.data?.permissions.canManage,
      query,
    ],
    queryFn: ({ pageParam }) =>
      listNativeRecords(tableId, nativeRecordQuerySchema.parse({ ...query, offset: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (page, _pages, offset) =>
      page.hasMore ? offset + page.records.length : undefined,
    enabled: table.isSuccess && !table.isError,
  });
  const changeKey = [
    "native-records",
    "changes",
    tableId,
    table.data?.output.revision,
    table.data?.permissions.actorUserId,
    table.data?.permissions.canManage,
  ];
  const changes = useQuery({
    queryKey: changeKey,
    queryFn: async () => {
      const previous = client.getQueryData<{
        nextCursor: number;
        hasMore: boolean;
        changes: NativeRecordChange[];
      }>(changeKey);
      const result = await listNativeRecordChanges(
        tableId,
        previous?.nextCursor ?? rows.data?.pages[0]?.changeCursor ?? 0,
      );

      if (result.changes.length) {
        await client.invalidateQueries({ queryKey: rowKey });
      }

      return result;
    },
    enabled: table.isSuccess && !table.isError && rows.isSuccess,
    refetchInterval: (state) => (state.state.data?.hasMore ? 100 : 15_000),
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: rowKey }),
      client.invalidateQueries({ queryKey: tableKey }),
      client.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all }),
    ]);
  const create = useMutation({
    mutationFn: (input: CreateNativeRecordInput) => createNativeRecord(tableId, input),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({ recordId, ...input }: UpdateNativeRecordInput & { recordId: string }) =>
      updateNativeRecord(tableId, recordId, input),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: ({ recordId, ...input }: DeleteNativeRecordInput & { recordId: string }) =>
      deleteNativeRecord(tableId, recordId, input),
    onSettled: refresh,
  });
  const updateTable = useMutation({
    mutationFn: (input: UpdateNativeRecordTableInput) => updateNativeRecordTable(tableId, input),
    onSettled: refresh,
  });

  return { table, rows, changes, create, update, remove, updateTable };
}
