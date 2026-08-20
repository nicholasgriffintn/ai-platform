import type { DefinitionEntry } from "./presentation";

export function DefinitionListView({ entries }: { entries: DefinitionEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <dl
      data-responsetype="definitions"
      className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(6rem,auto)_1fr]"
    >
      {entries.map((entry) => (
        <div key={entry.key} className="contents">
          <dt className="text-zinc-500 dark:text-zinc-400">{entry.label}</dt>
          <dd className="m-0 break-words font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
