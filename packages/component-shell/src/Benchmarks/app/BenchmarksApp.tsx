import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { useNavigate } from "react-router";

import { benchmarkPaths } from "../benchmark-display.js";
import { ManagedRunView } from "./ManagedRunView.js";
import { MyRuns } from "./MyRuns.js";
import { RunLauncher } from "./RunLauncher.js";

export function BenchmarksApp({ basePath, subpath }: { basePath: string; subpath: string }) {
  const navigate = useNavigate();
  const [section, runId] = subpath.split("/").filter(Boolean);
  const runHref = (id: string) => `${basePath}/runs/${encodeURIComponent(id)}`;

  if (section === "runs" && runId) {
    return <ManagedRunView runId={runId} onDeleted={() => void navigate(basePath)} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 pb-16">
      <header className="space-y-3">
        <p className="font-display text-4xl leading-tight text-foreground">
          Put your models on the perch.
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Runs use the same items, prompts and scoring as the public board. Models on your own keys
          cost no credit, runs stay private until you share a link, and they never join the public
          board.
        </p>
        <ButtonLink href={benchmarkPaths.index} variant="link">
          See the public boards
        </ButtonLink>
      </header>
      <section className="space-y-4">
        <h2 className="font-display text-2xl text-foreground">Start a run</h2>
        <RunLauncher
          onStarted={(runs) => {
            if (runs.length === 1 && runs[0]) {
              void navigate(runHref(runs[0].id));
            }
          }}
        />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl text-foreground">Your runs</h2>
        <MyRuns runHref={runHref} />
      </section>
    </div>
  );
}
