import {
  BenchmarkEntrantView,
  PageShell,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";
import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { benchmarkIdSchema } from "@ngriffin_uk/polychat-schemas";
import { useParams } from "react-router";

export function meta() {
  return [
    { title: "Benchmark run - Polychat" },
    { name: "description", content: "Every answer one model gave on a Polychat benchmark." },
  ];
}

export default function BenchmarkEntrant() {
  const params = useParams<{ benchmarkId: string; modelId: string }>();
  const parsed = benchmarkIdSchema.safeParse(params.benchmarkId);

  return (
    <PageShell
      title="Benchmarks"
      headerTitleAs="span"
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl"
    >
      {parsed.success && params.modelId ? (
        <BenchmarkEntrantView benchmarkId={parsed.data} modelId={params.modelId} />
      ) : (
        <PageStatus title="No such run" message="That benchmark or model does not exist." />
      )}
    </PageShell>
  );
}
