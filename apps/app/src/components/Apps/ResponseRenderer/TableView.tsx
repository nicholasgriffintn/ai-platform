interface TableViewProps {
  data: {
    headers: Array<{
      key: string;
      label: string;
    }>;
    rows: Array<Record<string, any>>;
  };
}

export const TableView = ({ data }: TableViewProps) => {
  const { headers, rows } = data;

  if (!headers || !rows || headers.length === 0) {
    return (
      <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
        There's no data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-off-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={
                rowIndex % 2 === 0
                  ? "bg-off-white dark:bg-zinc-900"
                  : "bg-zinc-50 dark:bg-zinc-800/50"
              }
            >
              {headers.map((header) => (
                <td
                  key={`${rowIndex}-${header.key}`}
                  className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300"
                >
                  {row[header.key] !== undefined
                    ? String(row[header.key])
                    : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
