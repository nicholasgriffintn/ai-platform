interface TableViewProps {
  data: {
    headers: Array<{
      key: string;
      label: string;
      format?: string;
    }>;
    rows: Array<Record<string, unknown>>;
  };
}

/**
 * `format` is declared on the tool response schema, so a tool can ask for a presentation its raw
 * value cannot carry — an ISO timestamp shown as a date, a ratio shown as a percentage.
 */
const formatCell = (value: unknown, format?: string): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  const scalar = value as string | number;

  switch (format) {
    case "date":
    case "datetime": {
      const parsed = new Date(scalar);

      if (Number.isNaN(parsed.getTime())) {
        return String(scalar);
      }

      return format === "date" ? parsed.toLocaleDateString() : parsed.toLocaleString();
    }

    case "percent": {
      const num = Number(scalar);

      return Number.isNaN(num) ? String(scalar) : `${(num * 100).toFixed(1)}%`;
    }

    case "number": {
      const num = Number(scalar);

      return Number.isNaN(num) ? String(scalar) : num.toLocaleString();
    }

    case undefined:
    default:
      return String(scalar);
  }
};

const isNumericColumn = (rows: Array<Record<string, unknown>>, key: string): boolean =>
  rows.length > 0 && rows.every((row) => row[key] == null || typeof row[key] === "number");

export const TableView = ({ data }: TableViewProps) => {
  const { headers, rows } = data;

  if (!headers || !rows || headers.length === 0) {
    return (
      <div
        data-responsetype="table"
        className="rounded-md border border-amber-200 bg-amber-100 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      >
        There's no data available.
      </div>
    );
  }

  return (
    <div
      data-responsetype="table"
      className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700"
    >
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className={`px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ${
                  isNumericColumn(rows, header.key) ? "text-right" : "text-left"
                }`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={rowIndex % 2 === 0 ? undefined : "bg-zinc-50/60 dark:bg-zinc-800/40"}
            >
              {headers.map((header) => (
                <td
                  key={`${rowIndex}-${header.key}`}
                  className={`max-w-[24rem] break-words px-3 py-2 align-top text-sm text-zinc-600 dark:text-zinc-300 ${
                    isNumericColumn(rows, header.key) ? "text-right tabular-nums" : "text-left"
                  }`}
                >
                  {formatCell(row[header.key], header.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
