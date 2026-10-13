import {
  PageShell,
  SharedBenchmarkRunView,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";
import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { useParams } from "react-router";

export function meta() {
  return [
    { title: "Shared benchmark run - Polychat" },
    { name: "description", content: "A benchmark run shared from Polychat." },
  ];
}

export default function SharedBenchmarkRun() {
  const { token } = useParams<{ token: string }>();

  return (
    <PageShell
      title="Benchmarks"
      headerTitleAs="span"
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl"
    >
      {token ? (
        <SharedBenchmarkRunView token={token} />
      ) : (
        <PageStatus title="No such run" message="That share link is not valid." />
      )}
    </PageShell>
  );
}
