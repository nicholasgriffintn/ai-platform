import type {
  NativeRecord,
  NativeRecordColumn,
  NativeRecordTable,
  NativeRecordValue,
  NativeRecordView as RecordView,
} from "@ngriffin_uk/polychat-schemas";

import { Button } from "../Button";

export interface NativeRecordViewProps {
  table: NativeRecordTable;
  records: NativeRecord[];
  view?: RecordView;
  isSaving: boolean;
  readOnly?: boolean;
  onEdit: (record: NativeRecord) => void;
  onDelete: (record: NativeRecord) => void;
  onChangeValue: (record: NativeRecord, columnId: string, value: NativeRecordValue) => void;
}

function RecordActions({ record, props }: { record: NativeRecord; props: NativeRecordViewProps }) {
  const canEdit =
    !props.readOnly &&
    props.table.output.status === "ready" &&
    (props.table.permissions.canEditAllRows ||
      record.createdByUserId === props.table.permissions.actorUserId);

  return canEdit ? (
    <div className="flex gap-1">
      <Button
        size="xs"
        variant="ghost"
        disabled={props.isSaving}
        onClick={() => props.onEdit(record)}
      >
        Edit
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={props.isSaving}
        onClick={() => props.onDelete(record)}
      >
        Delete
      </Button>
    </div>
  ) : null;
}

function RecordCell({
  record,
  column,
  props,
}: {
  record: NativeRecord;
  column: NativeRecordColumn;
  props: NativeRecordViewProps;
}) {
  const value = record.values[column.id];
  const canEdit =
    !props.readOnly &&
    props.table.output.status === "ready" &&
    (props.table.permissions.canEditAllRows ||
      record.createdByUserId === props.table.permissions.actorUserId);

  if (column.type === "boolean") {
    return (
      <input
        type="checkbox"
        aria-label={`${column.name} for record ${record.id}`}
        checked={value === true}
        disabled={!canEdit || props.isSaving}
        onChange={(event) => props.onChangeValue(record, column.id, event.currentTarget.checked)}
      />
    );
  }

  return (
    <span className="break-words whitespace-pre-wrap">
      {value === null || value === undefined ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        String(value)
      )}
    </span>
  );
}

export function NativeRecordView(props: NativeRecordViewProps) {
  const columns = props.table.definition.columns.filter(
    (column) => !props.view?.columns || props.view.columns.includes(column.id),
  );
  const group = props.table.definition.columns.find(
    (column) => column.id === props.view?.groupColumnId,
  );
  const checked = props.table.definition.columns.find(
    (column) => column.id === props.view?.checkedColumnId,
  );
  const titleColumn = columns.find((column) => column.type === "text") ?? columns[0];

  if (props.view?.presentation === "board" && group?.type === "select") {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2" aria-label={props.view.title}>
        {[...group.options, ""].map((option) => (
          <section
            key={option}
            className="min-w-64 flex-1 space-y-3 rounded-lg border border-border bg-surface p-3"
          >
            <h3 className="text-sm font-medium">{option || "Unassigned"}</h3>
            {props.records
              .filter((record) => String(record.values[group.id] ?? "") === option)
              .map((record) => (
                <article
                  key={record.id}
                  className="space-y-3 rounded-md border border-border bg-background p-3 text-sm"
                >
                  {titleColumn ? (
                    <RecordCell record={record} column={titleColumn} props={props} />
                  ) : (
                    record.id
                  )}
                  {columns
                    .filter((column) => column.id !== titleColumn?.id && column.id !== group.id)
                    .map((column) => (
                      <div key={column.id}>
                        <span className="text-xs text-muted-foreground">{column.name}: </span>
                        <RecordCell record={record} column={column} props={props} />
                      </div>
                    ))}
                  <RecordActions record={record} props={props} />
                </article>
              ))}
          </section>
        ))}
      </div>
    );
  }

  if (props.view?.presentation === "checklist" && checked?.type === "boolean") {
    return (
      <ul className="divide-y divide-border" aria-label={props.view.title}>
        {props.records.map((record) => (
          <li key={record.id} className="flex items-center gap-3 py-3 text-sm">
            <RecordCell record={record} column={checked} props={props} />
            <div className="flex-1">
              {titleColumn ? (
                <RecordCell record={record} column={titleColumn} props={props} />
              ) : (
                record.id
              )}
            </div>
            <RecordActions record={record} props={props} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{props.view?.title ?? props.table.output.title}</caption>
        <thead className="bg-surface text-left">
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className="min-w-36 p-3 font-medium">
                {column.name}
              </th>
            ))}
            <th scope="col" className="p-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {props.records.map((record) => (
            <tr key={record.id}>
              {columns.map((column) => (
                <td key={column.id} className="max-w-md p-3 align-top">
                  <RecordCell record={record} column={column} props={props} />
                </td>
              ))}
              <td className="p-3 align-top">
                <RecordActions record={record} props={props} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
