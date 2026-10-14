import type { BenchmarkItemDetail } from "@ngriffin_uk/polychat-schemas";
import { getNumberProperty, getStringProperty } from "@ngriffin_uk/polychat-utility-core";

import { ArtefactView } from "./ArtefactView.js";

export function ArtefactItems({
  items,
  entrantName,
  emptyLabel,
}: {
  items: readonly BenchmarkItemDetail[];
  entrantName: string;
  emptyLabel: string;
}) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((detail) => {
        const judge = getNumberProperty(detail.result?.detail, "judge");
        const reason = detail.result?.error ?? getStringProperty(detail.result?.detail, "reason");
        const heading =
          getStringProperty(detail.item.data, "mood") ?? detail.item.id.replace("-", " ");

        return (
          <li key={detail.item.id} className="space-y-2">
            <p className="text-sm font-medium text-foreground capitalize">{heading}</p>
            {detail.result?.artefact ? (
              <ArtefactView
                artefact={detail.result.artefact}
                title={`${entrantName}: ${heading}`}
              />
            ) : (
              <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                <span>{emptyLabel}</span>
                {reason ? <span className="max-w-full text-xs break-words">{reason}</span> : null}
              </div>
            )}
            {judge !== undefined ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                Judge seed {Math.round(judge * 100)} / 100
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
