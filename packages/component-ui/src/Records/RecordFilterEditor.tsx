import {
  nativeRecordFilterSchema,
  type NativeRecordColumn,
  type NativeRecordFilter,
} from "@ngriffin_uk/polychat-schemas";

import { Button } from "../Button";
import { Input } from "../input";

export function RecordFilterEditor({
  columns,
  filter,
  onChange,
  onRemove,
}: {
  columns: NativeRecordColumn[];
  filter: NativeRecordFilter;
  onChange: (filter: NativeRecordFilter) => void;
  onRemove: () => void;
}) {
  const column = columns.find((item) => item.id === filter.columnId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter column"
        className="h-9 rounded-md border border-input bg-surface px-2 text-sm"
        value={filter.columnId}
        onChange={(event) =>
          onChange({ columnId: event.currentTarget.value, operator: "is_empty" })
        }
      >
        {columns.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter operation"
        className="h-9 rounded-md border border-input bg-surface px-2 text-sm"
        value={filter.operator}
        onChange={(event) => {
          const parsed = nativeRecordFilterSchema.safeParse({
            ...filter,
            operator: event.currentTarget.value,
            value:
              filter.value ??
              (column?.type === "boolean"
                ? false
                : column?.type === "number"
                  ? 0
                  : column?.type === "select"
                    ? column.options[0]
                    : ""),
          });

          if (parsed.success) {
            onChange(parsed.data);
          }
        }}
      >
        <option value="is_empty">Is empty</option>
        <option value="eq">Equals</option>
        <option value="ne">Does not equal</option>
        {column?.type === "text" ? <option value="contains">Contains</option> : null}
        {column?.type === "number" || column?.type === "date" ? (
          <>
            <option value="gt">Greater than</option>
            <option value="gte">At least</option>
            <option value="lt">Less than</option>
            <option value="lte">At most</option>
          </>
        ) : null}
      </select>
      {filter.operator !== "is_empty" ? (
        column?.type === "boolean" ? (
          <select
            aria-label="Filter value"
            className="h-9 rounded-md border border-input bg-surface px-2 text-sm"
            value={filter.value === true ? "true" : "false"}
            onChange={(event) =>
              onChange({ ...filter, value: event.currentTarget.value === "true" })
            }
          >
            <option value="true">Checked</option>
            <option value="false">Unchecked</option>
          </select>
        ) : column?.type === "select" ? (
          <select
            aria-label="Filter value"
            className="h-9 rounded-md border border-input bg-surface px-2 text-sm"
            value={String(filter.value ?? "")}
            onChange={(event) => onChange({ ...filter, value: event.currentTarget.value })}
          >
            <option value="">Choose…</option>
            {column.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <Input
            aria-label="Filter value"
            className="w-40"
            type={column?.type === "number" ? "number" : column?.type === "date" ? "date" : "text"}
            step="any"
            value={String(filter.value ?? "")}
            onChange={(event) =>
              onChange({
                ...filter,
                value:
                  column?.type === "number"
                    ? event.currentTarget.valueAsNumber
                    : event.currentTarget.value,
              })
            }
          />
        )
      ) : null}
      <Button type="button" size="xs" variant="ghost" onClick={onRemove}>
        Remove filter
      </Button>
    </div>
  );
}
