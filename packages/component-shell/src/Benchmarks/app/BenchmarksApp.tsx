import { ButtonLink, cn } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "@ngriffin_uk/polychat-library-react";
import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "../../Account/SignInEmptyState.js";
import { benchmarkPaths } from "../benchmark-display.js";
import { ManagedRunView } from "./ManagedRunView.js";
import { MyRuns } from "./MyRuns.js";
import { OfficialRuns } from "./OfficialRuns.js";
import { RunLauncher } from "./RunLauncher.js";

function SectionTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <ButtonLink
      href={href}
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn(active ? "text-foreground" : "text-muted-foreground")}
    >
      {children}
    </ButtonLink>
  );
}

export function BenchmarksApp({ basePath, subpath }: { basePath: string; subpath: string }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStatus();
  const [section, runId] = subpath.split("/").filter(Boolean);
  const runHref = (id: string) => `${basePath}/runs/${encodeURIComponent(id)}`;
  const isAdmin = user?.role === "admin";
  const officialHref = `${basePath}/official`;

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

  const showOfficial = isAdmin && section === "official";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isAdmin ? (
          <nav aria-label="Benchmark sections" className="flex gap-1">
            <SectionTab href={basePath} active={!showOfficial}>
              Your runs
            </SectionTab>
            <SectionTab href={officialHref} active={showOfficial}>
              Official runs
            </SectionTab>
          </nav>
        ) : (
          <span />
        )}
        <ButtonLink
          href={benchmarkPaths.index}
          variant="outline"
          size="sm"
          icon={<ArrowUpRight size={14} />}
        >
          Public boards
        </ButtonLink>
      </div>

      {showOfficial ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl text-foreground">Official runs</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Every lineup and decision model from the approved labs against every board. Queue what
              is missing, watch the queue drain, and retry what fell over.
            </p>
          </div>
          <OfficialRuns runHref={runHref} />
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-2xl text-foreground">Start a run</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Same items, prompts and scoring as the public board. Runs stay private until you
                share a link, and they never join the public board.
              </p>
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
        </>
      )}
    </div>
  );
}
