import type {
  NativeRecord,
  NativeRecordDefinition,
  NativeRecordValues,
  NativeRecordValue,
  SiteRecordOperation,
  SiteRecordOperationResponse,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { useSiteRecordRuntime } from "./record-context.js";

type QueryResult = Extract<SiteRecordOperationResponse, { operation: "query" }>;
interface RecordDraft {
  requestId: string;
  tableRevision: number;
  definition: NativeRecordDefinition;
  record: NativeRecord | null;
}

export function useSiteRecordView(viewId: string) {
  const runtime = useSiteRecordRuntime();
  const [data, setData] = useState<QueryResult | null>(null);
  const [records, setRecords] = useState<NativeRecord[]>([]);
  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [deleting, setDeleting] = useState<NativeRecord | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestVersion = useRef(0);
  const read = async (offset = 0) => {
    if (!runtime?.revision) {
      setError("Open the saved Site to access these records");

      return;
    }

    const version = ++requestVersion.current;

    setLoading(true);
    try {
      const response = await runtime.execute({
        operation: "query",
        viewId,
        siteRevision: runtime.revision,
        offset,
        limit: 100,
      });

      if (version !== requestVersion.current) {
        return;
      }

      if (response.operation !== "query") {
        throw new Error("Unexpected record response");
      }

      setData(response);
      setRecords((current) =>
        offset === 0 ? response.result.records : [...current, ...response.result.records],
      );
      setError(undefined);
    } catch (cause) {
      if (version !== requestVersion.current) {
        return;
      }

      setData(null);
      setRecords([]);
      setError(getErrorMessage(cause, "Records could not be loaded"));
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  };

  const refresh = useEffectEvent(() => read());

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15_000);

    return () => {
      clearInterval(timer);
      requestVersion.current += 1;
    };
  }, [runtime, viewId]);
  const open = (record: NativeRecord | null) => {
    if (!data) {
      return;
    }

    setError(undefined);
    setDraft({
      requestId: crypto.randomUUID(),
      tableRevision: data.table.output.revision,
      definition: data.table.definition,
      record,
    });
  };

  const mutate = async (operation: SiteRecordOperation) => {
    if (!runtime) {
      return false;
    }

    setSaving(true);
    setError(undefined);
    try {
      await runtime.execute(operation);
      await read();

      return true;
    } catch (cause) {
      setError(getErrorMessage(cause, "The record could not be saved"));

      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async (values: NativeRecordValues) => {
    if (!draft || !runtime?.revision) {
      return false;
    }

    const fields = { viewId, siteRevision: runtime.revision };
    const input = { tableRevision: draft.tableRevision, values };
    const success = await mutate(
      draft.record
        ? {
            ...fields,
            operation: "update",
            recordId: draft.record.id,
            input: { ...input, expectedRevision: draft.record.revision },
          }
        : { ...fields, operation: "create", input: { ...input, requestId: draft.requestId } },
    );

    if (success) {
      setDraft(null);
    }

    return success;
  };

  const changeValue = async (record: NativeRecord, columnId: string, value: NativeRecordValue) => {
    if (!data || !runtime?.revision) {
      return;
    }

    await mutate({
      operation: "update",
      viewId,
      siteRevision: runtime.revision,
      recordId: record.id,
      input: {
        tableRevision: data.table.output.revision,
        expectedRevision: record.revision,
        values: { ...record.values, [columnId]: value },
      },
    });
  };

  const remove = async () => {
    if (!deleting || !data || !runtime?.revision) {
      return;
    }

    if (
      await mutate({
        operation: "delete",
        viewId,
        siteRevision: runtime.revision,
        recordId: deleting.id,
        input: { tableRevision: data.table.output.revision, expectedRevision: deleting.revision },
      })
    ) {
      setDeleting(null);
    }
  };

  return {
    data,
    records,
    draft,
    deleting,
    error,
    saving,
    loading,
    open,
    save,
    changeValue,
    remove,
    read,
    setDraft,
    setDeleting,
  };
}
