import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface PlatformColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function PlatformTable<T>({
  columns,
  rows,
  rowKey,
  onOpen,
  empty,
  minWidth = 640,
}: {
  columns: readonly PlatformColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  empty: ReactNode;
  minWidth?: number;
}): ReactNode {
  if (rows.length === 0) {
    return empty;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn("border-t border-border", onOpen && "cursor-pointer hover:bg-muted/40")}
              onClick={onOpen ? () => onOpen(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("px-3 py-2 align-top", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrimaryCell({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <div>
      <div className="font-medium text-foreground">{title}</div>
      {detail && <div className="font-mono text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}
