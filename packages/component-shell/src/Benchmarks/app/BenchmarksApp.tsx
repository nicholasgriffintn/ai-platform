import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "@ngriffin_uk/polychat-library-react";
import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "../../Account/SignInEmptyState.js";
import { benchmarkPaths } from "../benchmark-display.js";
import { ManagedRunView } from "./ManagedRunView.js";
import { MyRuns } from "./MyRuns.js";
import { RunLauncher } from "./RunLauncher.js";

export function BenchmarksApp({ basePath, subpath }: { basePath: string; subpath: string }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStatus();
  const [section, runId] = subpath.split("/").filter(Boolean);
  const runHref = (id: string) => `${basePath}/runs/${encodeURIComponent(id)}`;

  if (!isAuthenticated) {
    return (
      <SignInEmptyState
        title="Sign in to run benchmarks"
        message="Runs are kept against your account, and models on your own keys cost no credit."
      />
    );
  }

  if (section === "runs" && runId) {
    return <ManagedRunView runId={runId} onDeleted={() => void navigate(basePath)} />;
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-display text-2xl text-foreground">Start a run</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Same items, prompts and scoring as the public board. Runs stay private until you share
              a link, and they never join the public board.
            </p>
          </div>
          <ButtonLink
            href={benchmarkPaths.index}
            variant="outline"
            size="sm"
            icon={<ArrowUpRight size={14} />}
          >
            Results
          </ButtonLink>
        </div>
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
