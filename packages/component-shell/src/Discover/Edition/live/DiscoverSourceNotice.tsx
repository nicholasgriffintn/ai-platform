import type { DiscoverSettings } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

type DiscoverSource = DiscoverSettings["sources"][number];

export function listDiscoverFailingSources(
  sources: readonly DiscoverSource[],
  now: number,
): DiscoverSource[] {
  return sources.filter(
    (source) =>
      source.connected &&
      source.used &&
      source.lastError &&
      (!source.lastReadAt || now - Date.parse(source.lastReadAt) > DAY_MS),
  );
}

export function DiscoverSourceNotice({
  sources,
}: {
  sources: DiscoverSettings["sources"] | undefined;
}) {
  const [now] = useState(Date.now);
  const failing = listDiscoverFailingSources(sources ?? [], now);

  if (failing.length === 0) {
    return null;
  }

  return (
    <ul className="mb-6 flex flex-col gap-1 text-sm text-muted-foreground">
      {failing.map((source) => (
        <li key={source.providerId} className="flex items-start gap-2">
          <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-foreground">{source.name}: </span>
            {source.lastError}
          </span>
        </li>
      ))}
    </ul>
  );
}
