import { useNativeRecords } from "@ngriffin_uk/polychat-library-react";
import type {
  NativeRecord,
  NativeRecordDefinition,
  NativeRecordValues,
  NativeRecordValue,
  NativeRecordView,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

type RecordFormState = {
  requestId: string;
  tableRevision: number;
  definition: NativeRecordDefinition;
  record: NativeRecord | null;
};
type TableFormState = { title: string; definition: NativeRecordDefinition; revision: number };

export function useRecordWorkbench(tableId: string, view?: NativeRecordView) {
  const controller = useNativeRecords(tableId, view?.query);
  const [form, setForm] = useState<RecordFormState | null>(null);
  const [deletion, setDeletion] = useState<{ record: NativeRecord; tableRevision: number } | null>(
    null,
  );
  const setDeleting = (record: NativeRecord | null) => {
    const tableRevision = controller.table.data?.output.revision;

    setDeletion(record && tableRevision ? { record, tableRevision } : null);
  };

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [tableForm, setTableForm] = useState<TableFormState | null>(null);
  const openForm = (record: NativeRecord | null) => {
    const table = controller.table.data;

    if (table) {
      setErrorMessage(undefined);
      setForm({
        requestId: generateId(),
        tableRevision: table.output.revision,
        definition: table.definition,
        record,
      });
    }
  };

  const openTableForm = () => {
    const table = controller.table.data;

    if (table) {
      setTableForm({
        title: table.output.title,
        definition: table.definition,
        revision: table.output.revision,
      });
    }
  };

  const save = async (values: NativeRecordValues) => {
    if (!form) {
      return false;
    }

    setErrorMessage(undefined);
    try {
      if (form.record) {
        await controller.update.mutateAsync({
          recordId: form.record.id,
          tableRevision: form.tableRevision,
          expectedRevision: form.record.revision,
          values,
        });
      } else {
        await controller.create.mutateAsync({
          requestId: form.requestId,
          tableRevision: form.tableRevision,
          values,
        });
      }

      setForm(null);

      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save the record"));

      return false;
    }
  };

  const changeValue = async (record: NativeRecord, columnId: string, value: NativeRecordValue) => {
    const tableRevision = controller.table.data?.output.revision;

    if (!tableRevision) {
      return;
    }

    setErrorMessage(undefined);
    try {
      await controller.update.mutateAsync({
        recordId: record.id,
        tableRevision,
        expectedRevision: record.revision,
        values: { ...record.values, [columnId]: value },
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save the record"));
    }
  };

  const confirmRemove = async () => {
    if (!deletion) {
      return;
    }

    try {
      await controller.remove.mutateAsync({
        recordId: deletion.record.id,
        tableRevision: deletion.tableRevision,
        expectedRevision: deletion.record.revision,
      });
      setDeleting(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete the record"));
      throw error;
    }
  };

  return {
    ...controller,
    form,
    setForm,
    deleting: deletion?.record ?? null,
    setDeleting,
    errorMessage,
    setErrorMessage,
    tableForm,
    setTableForm,
    openTableForm,
    openForm,
    save,
    changeValue,
    confirmRemove,
    isSaving:
      controller.create.isPending || controller.update.isPending || controller.remove.isPending,
  };
}
