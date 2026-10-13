import type { BenchmarkItemDetail } from "@ngriffin_uk/polychat-schemas";
import {
  getNumberProperty,
  getStringProperty,
  readArray,
  readFiniteNumber,
} from "@ngriffin_uk/polychat-utility-core";

function Verdict({ detail }: { detail: BenchmarkItemDetail }) {
  const points = getNumberProperty(detail.result?.detail, "points");
  const reason = getStringProperty(detail.result?.detail, "reason");

  if (detail.result?.error) {
    return <span className="text-failure">No answer</span>;
  }

  if (points === undefined) {
    return <span className="text-failure">{reason ?? "Broke the rules"}</span>;
  }

  return (
    <span className={points === 10 ? "text-success" : points > 0 ? "text-attention" : ""}>
      {points} pts
    </span>
  );
}

export function CountdownItems({ items }: { items: readonly BenchmarkItemDetail[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="py-2.5 pr-4 pl-4 font-normal">Numbers</th>
            <th className="py-2.5 pr-4 font-normal">Target</th>
            <th className="py-2.5 pr-4 font-normal">Working</th>
            <th className="py-2.5 pr-4 font-normal">Score</th>
            <th className="py-2.5 pr-4 font-normal">It could be done</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((detail) => {
            const numbers = readArray(detail.item.data.numbers)
              .map(readFiniteNumber)
              .filter((value) => value !== undefined);
            const value = getNumberProperty(detail.result?.detail, "value");

            return (
              <tr key={detail.item.id}>
                <td className="py-2.5 pr-4 pl-4 font-mono tabular-nums">{numbers.join("  ")}</td>
                <td className="py-2.5 pr-4 font-display text-lg tabular-nums">
                  {getNumberProperty(detail.reveal, "target")}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs">
                  {getStringProperty(detail.result?.answer, "expression") ?? "–"}
                  {value !== undefined ? (
                    <span className="text-muted-foreground"> = {value}</span>
                  ) : null}
                </td>
                <td className="py-2.5 pr-4 tabular-nums">
                  <Verdict detail={detail} />
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                  {getStringProperty(detail.reveal, "solution")} ={" "}
                  {getNumberProperty(detail.reveal, "best")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
