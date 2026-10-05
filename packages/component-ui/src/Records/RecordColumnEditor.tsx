import type { NativeRecordColumn } from "@ngriffin_uk/polychat-schemas";

import { Button } from "../Button";
import { Input } from "../input";
import { Textarea } from "../Textarea";

interface RecordColumnEditorProps {
  column: NativeRecordColumn;
  canRemove: boolean;
  onChange: (column: NativeRecordColumn) => void;
  onType: (type: string) => void;
  onRemove: () => void;
}

export function RecordColumnEditor({
  column,
  canRemove,
  onChange,
  onType,
  onRemove,
}: RecordColumnEditorProps) {
  return (
    <fieldset className="space-y-3 rounded-md border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Column name
          <Input
            value={column.name}
            onChange={(event) => onChange({ ...column, name: event.currentTarget.value })}
            required
            maxLength={120}
          />
        </label>
        <label className="space-y-1 text-sm">
          Type
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={column.type}
            onChange={(event) => onType(event.currentTarget.value)}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Checkbox</option>
            <option value="date">Date</option>
            <option value="select">Choice</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={column.required}
            onChange={(event) => onChange({ ...column, required: event.currentTarget.checked })}
          />
          Required
        </label>
      </div>
      {column.type === "select" ? (
        <label className="block space-y-1 text-sm">
          Choices, one per line
          <Textarea
            value={column.options.join("\n")}
            onChange={(event) =>
              onChange({ ...column, options: event.currentTarget.value.split("\n") })
            }
            rows={3}
            required
          />
        </label>
      ) : null}
      {column.type === "text" ? (
        <label className="block space-y-1 text-sm">
          Maximum length
          <Input
            type="number"
            value={column.maxLength}
            min={1}
            max={10000}
            required
            onChange={(event) =>
              onChange({ ...column, maxLength: event.currentTarget.valueAsNumber })
            }
          />
        </label>
      ) : null}
      {column.type === "number" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            Minimum
            <Input
              type="number"
              step="any"
              value={column.minimum ?? ""}
              onChange={(event) =>
                onChange({
                  ...column,
                  minimum:
                    event.currentTarget.value === ""
                      ? undefined
                      : event.currentTarget.valueAsNumber,
                })
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            Maximum
            <Input
              type="number"
              step="any"
              value={column.maximum ?? ""}
              onChange={(event) =>
                onChange({
                  ...column,
                  maximum:
                    event.currentTarget.value === ""
                      ? undefined
                      : event.currentTarget.valueAsNumber,
                })
              }
            />
          </label>
        </div>
      ) : null}
      <Button type="button" size="xs" variant="ghost" disabled={!canRemove} onClick={onRemove}>
        Remove column
      </Button>
    </fieldset>
  );
}
