import {
  EvalComparison,
  PlatformTable,
  RegistryPanel,
} from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  useEvalCaseResults,
  useEvalRuns,
  useEvalSuites,
  useGraders,
  useModelPlatformMutations,
  useModelRoutes,
} from "@ngriffin_uk/polychat-library-react";
import type { EvalSuite } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { CreateSuiteDialog } from "../flows/CreateSuiteDialog.js";
import { GraderDialog } from "../flows/GraderDialog.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

function GradersSection({ onCreate }: { onCreate: () => void }) {
  const { workspaceId, projectId, can } = useModelsScope();
  const graders = useGraders(workspaceId, projectId);
  const mutations = useModelPlatformMutations(workspaceId);

  return (
    <ModelsSection
      title="Graders"
      description="Shared by eval suites, reinforcement rewards and alias gates."
      actions={
        can("build_datasets") && (
          <Button size="sm" variant="secondary" onClick={onCreate}>
            New grader
          </Button>
        )
      }
    >
      {graders.isLoading ? (
        <CardSkeleton />
      ) : (
        <PlatformTable
          rows={graders.data ?? []}
          rowKey={(grader) => grader.id}
          minWidth={520}
          empty={
            <p className="text-sm text-muted-foreground">
              No graders yet. Start with one that checks for the right answer.
            </p>
          }
          columns={[
            { key: "name", label: "Grader", render: (grader) => grader.name },
            {
              key: "metric",
              label: "Metric",
              render: (grader) => <span className="font-mono text-xs">{grader.metric}</span>,
            },
            {
              key: "kind",
              label: "Kind",
              render: (grader) => grader.config.kind.replace("_", " "),
            },
            { key: "revision", label: "Revision", render: (grader) => grader.revision },
            {
              key: "delete",
              label: "",
              render: (grader) =>
                can("build_datasets") && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      void runWithToast("Grader deleted", () =>
                        mutations.deleteGrader.mutateAsync(grader.id),
                      )
                    }
                  >
                    Delete
                  </Button>
                ),
            },
          ]}
        />
      )}
    </ModelsSection>
  );
}

function SuiteRunner({
  suite,
  suites,
  onSelect,
}: {
  suite: EvalSuite;
  suites: EvalSuite[];
  onSelect: (id: string) => void;
}) {
  const { workspaceId, projectId } = useModelsScope();
  const routes = useModelRoutes(workspaceId, projectId);
  const graders = useGraders(workspaceId, projectId);
  const runs = useEvalRuns(workspaceId, suite.id);
  const mutations = useModelPlatformMutations(workspaceId);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const caseResults = useEvalCaseResults(workspaceId, selectedRunId);
  const activeRoutes = (routes.data ?? []).filter((route) => route.status === "active");
  const metrics = (graders.data ?? [])
    .filter((grader) => suite.graderIds.includes(grader.id))
    .map((grader) => grader.metric);

  return (
    <div className="space-y-8">
      <RegistryPanel>
        <FormSelect
          label="Suite"
          options={suites.map((item) => ({
            value: item.id,
            label: `${item.name} (${item.cases.length} cases)`,
          }))}
          value={suite.id}
          onValueChange={(value) => {
            onSelect(value);
            setSelectedRunId(undefined);
          }}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium">Routes to compare (up to six)</p>
          {activeRoutes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Deploy a model or register a provider route first.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeRoutes.map((route) => (
                <label
                  key={route.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRouteIds.includes(route.id)}
                    onChange={() =>
                      setSelectedRouteIds((current) =>
                        current.includes(route.id)
                          ? current.filter((id) => id !== route.id)
                          : [...current, route.id].slice(-6),
                      )
                    }
                  />
                  <span className="min-w-0 truncate">
                    {route.displayName} · {route.provider} · {route.region}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border pt-4">
          <Button
            size="sm"
            variant="primary"
            disabled={selectedRouteIds.length === 0 || mutations.startEvalRuns.isPending}
            onClick={() =>
              void runWithToast(`Queued ${selectedRouteIds.length} run(s)`, () =>
                mutations.startEvalRuns.mutateAsync({
                  suiteId: suite.id,
                  routeIds: selectedRouteIds,
                }),
              )
            }
          >
            Run suite
          </Button>
        </div>
      </RegistryPanel>

      <ModelsSection
        title="Comparison"
        description="Latest run per route. Select a row to read its answers."
      >
        <EvalComparison
          metrics={metrics}
          runs={runs.data ?? []}
          routes={(routes.data ?? []).map((route) => ({
            id: route.id,
            label: route.displayName,
            detail: `${route.provider} · ${route.region}`,
          }))}
          onOpenRun={(item) => setSelectedRunId(item.id)}
        />
      </ModelsSection>

      {selectedRunId && (
        <ModelsSection title="Case results">
          {caseResults.isLoading ? (
            <CardSkeleton />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {(caseResults.data ?? []).map((result) => (
                <li key={result.caseId} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{result.caseId}</span>
                    {Object.entries(result.scores).map(([metric, score]) => (
                      <span key={metric}>
                        {metric}: {score.toFixed(2)}
                      </span>
                    ))}
                    <span>{(result.latencyMs / 1000).toFixed(1)}s</span>
                  </div>
                  <p className="font-medium">
                    {suite.cases.find((item) => item.id === result.caseId)?.input}
                  </p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {result.error ?? result.output}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ModelsSection>
      )}
    </div>
  );
}

export function EvaluationsPlace() {
  const { workspaceId, projectId, can } = useModelsScope();
  const suites = useEvalSuites(workspaceId, projectId);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | undefined>();
  const [dialog, setDialog] = useState<"suite" | "grader" | null>(null);
  const suite = suites.data?.find((item) => item.id === selectedSuiteId) ?? suites.data?.[0];

  return (
    <div className="space-y-8">
      <GradersSection onCreate={() => setDialog("grader")} />
      <ModelsSection
        title="Suites"
        description="Real questions from your own work. Public leaderboards are a shortlist, not a verdict."
        actions={
          can("build_datasets") && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("suite")}>
              New suite
            </Button>
          )
        }
      >
        {suites.isLoading ? (
          <CardSkeleton />
        ) : suite && suites.data ? (
          <SuiteRunner suite={suite} suites={suites.data} onSelect={setSelectedSuiteId} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No suites yet. Start with ten real questions.
          </p>
        )}
      </ModelsSection>
      <CreateSuiteDialog
        open={dialog === "suite"}
        onOpenChange={(value) => setDialog(value ? "suite" : null)}
      />
      <GraderDialog
        open={dialog === "grader"}
        onOpenChange={(value) => setDialog(value ? "grader" : null)}
      />
    </div>
  );
}
