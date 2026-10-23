import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SheetOutputContent } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { formatSheetCell, isNumericSheetColumn } from "./sheet-cells";

export interface SheetViewProps {
  content: SheetOutputContent;
  maxRows?: number;
}

export function SheetView({ content, maxRows }: SheetViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const table = content.tables[activeIndex] ?? content.tables[0];

  if (!table) {
    return null;
  }

  const rows = maxRows === undefined ? table.rows : table.rows.slice(0, maxRows);
  const hidden = table.rows.length - rows.length;

  return (
    <div className="flex flex-col gap-2" data-output-kind="sheet">
      {content.tables.length > 1 ? (
        <div role="tablist" aria-label="Tables" className="flex flex-wrap gap-1">
          {content.tables.map((candidate, index) => (
            <button
              key={candidate.name}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                index === activeIndex
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {candidate.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{table.name}</caption>
          <thead className="bg-surface-elevated">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "border-b border-border px-3 py-2 font-medium whitespace-nowrap",
                    isNumericSheetColumn(column) ? "text-right" : "text-left",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-b-0">
                {table.columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-1.5 align-top",
                      isNumericSheetColumn(column) ? "text-right tabular-nums" : "text-left",
                    )}
                  >
                    {formatSheetCell(row[column.key], column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 ? (
        <p className="text-xs text-muted-foreground">
          {hidden} more {hidden === 1 ? "row" : "rows"} in the full sheet.
        </p>
      ) : null}
    </div>
  );
}
