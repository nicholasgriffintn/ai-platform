import {
  BenchmarkBoardView,
  PageShell,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";
import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { benchmarkIdSchema } from "@ngriffin_uk/polychat-schemas";
import { useParams } from "react-router";

export function meta() {
  return [
    { title: "Benchmark - Polychat" },
    {
      name: "description",
      content:
        "A Polychat benchmark board with intervals, costs, voting and a round for you to play.",
    },
  ];
}

export default function BenchmarkBoard() {
  const parsed = benchmarkIdSchema.safeParse(useParams<{ benchmarkId: string }>().benchmarkId);

  return (
    <PageShell
      title="Benchmarks"
      headerTitleAs="span"
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl"
    >
      {parsed.success ? (
        <BenchmarkBoardView benchmarkId={parsed.data} />
      ) : (
        <PageStatus title="No such benchmark" message="That board does not exist." />
      )}
    </PageShell>
  );
}
