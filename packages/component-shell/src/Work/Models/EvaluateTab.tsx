import { EvalComparison, RegistryPanel } from "@ngriffin_uk/polychat-component-models";
import {
  Button,
  CardSkeleton,
  FormDialog,
  FormInput,
  FormSelect,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { parseEvalCaseLines } from "@ngriffin_uk/polychat-library-model-registry";
import {
  useEvalCaseResults,
  useEvalRuns,
  useEvalSuites,
  useModelRegistryMutations,
  useModelRoutes,
} from "@ngriffin_uk/polychat-library-react";
import type { EvalScorer } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

import { ModelsSection } from "./ModelsSection.js";

type ScorerChoice = "contains" | "exact" | "judge";

const SCORER_OPTIONS = [
  { value: "contains", label: "Contains the expected answer" },
  { value: "exact", label: "Matches the expected answer exactly" },
  { value: "judge", label: "Graded against a rubric by the judge model" },
] as const;

function buildScorer(choice: ScorerChoice, rubric: string): EvalScorer {
  return choice === "judge"
    ? { type: "judge", metric: "quality", rubric }
    : { type: choice, metric: choice === "exact" ? "exact" : "correct" };
}

function CreateSuiteDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId?: string;
}) {
  const mutations = useModelRegistryMutations(workspaceId);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [casesText, setCasesText] = useState("");
  const [scorer, setScorer] = useState<ScorerChoice>("contains");
  const [rubric, setRubric] = useState("Score 5 for a correct, courteous, complete reply.");
  const parsed = parseEvalCaseLines(casesText);

  const submit = async () => {
    try {
      await mutations.createSuite.mutateAsync({
        projectId: projectId ?? null,
        name,
        systemPrompt: systemPrompt || undefined,
        cases: parsed.cases,
        scorers: [buildScorer(scorer, rubric)],
        replaySampleSize: Math.min(50, parsed.cases.length),
      });
      toast.success("Suite saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save the suite"));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New eval suite"
      description="One case per line: a question, then ' => ' and the expected answer. JSON lines with input and expected also work."
      onSubmit={submit}
      submitText="Save suite"
      isLoading={mutations.createSuite.isPending}
      submitDisabled={!name.trim() || parsed.cases.length === 0 || parsed.errors.length > 0}
    >
      <div className="space-y-3">
        <FormInput label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <FormInput
          label="System prompt"
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
        <Textarea
          aria-label="Cases"
          value={casesText}
          onChange={(event) => setCasesText(event.target.value)}
          className="min-h-[160px] font-mono text-xs"
          placeholder="How do I reset my password? => Settings, then Security"
        />
        <p className="text-xs text-muted-foreground">
          {parsed.cases.length} case(s)
          {parsed.errors.length > 0 ? ` · ${parsed.errors.join("; ")}` : ""}
        </p>
        <FormSelect
          label="Scoring"
          options={SCORER_OPTIONS}
          value={scorer}
          onValueChange={setScorer}
        />
        {scorer === "judge" && (
          <Textarea
            aria-label="Rubric"
            value={rubric}
            onChange={(event) => setRubric(event.target.value)}
            className="min-h-[80px] text-sm"
          />
        )}
      </div>
    </FormDialog>
  );
}

export function EvaluateTab({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId?: string;
}) {
  const suites = useEvalSuites(workspaceId, projectId);
  const routes = useModelRoutes(workspaceId, projectId);
  const mutations = useModelRegistryMutations(workspaceId);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | undefined>();
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const suite = suites.data?.find((item) => item.id === selectedSuiteId) ?? suites.data?.[0];
  const runs = useEvalRuns(workspaceId, suite?.id);
  const caseResults = useEvalCaseResults(workspaceId, selectedRunId);
  const activeRoutes = (routes.data ?? []).filter((route) => route.status === "active");

  const toggleRoute = (routeId: string) =>
    setSelectedRouteIds((current) =>
      current.includes(routeId)
        ? current.filter((id) => id !== routeId)
        : [...current, routeId].slice(-6),
    );

  const run = async () => {
    if (!suite) {
      return;
    }

    try {
      await mutations.startRuns.mutateAsync({ suiteId: suite.id, routeIds: selectedRouteIds });
      toast.success(`Queued ${selectedRouteIds.length} run(s)`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start the runs"));
    }
  };

  if (suites.isLoading || routes.isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <ModelsSection
        title="Suite"
        description="Real questions from your own work. Public leaderboards are a shortlist, not a verdict."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            New suite
          </Button>
        }
      >
        {suite && suites.data ? (
          <RegistryPanel>
            <FormSelect
              label="Suite"
              options={suites.data.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.cases.length} cases)`,
              }))}
              value={suite.id}
              onValueChange={(value) => {
                setSelectedSuiteId(value);
                setSelectedRunId(undefined);
              }}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Routes to compare (up to six)</p>
              {activeRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Register a route on a model version first.
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
                        onChange={() => toggleRoute(route.id)}
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
                disabled={selectedRouteIds.length === 0 || mutations.startRuns.isPending}
                onClick={() => void run()}
              >
                Run suite
              </Button>
            </div>
          </RegistryPanel>
        ) : (
          <p className="text-sm text-muted-foreground">
            No suites yet. Start with ten real questions.
          </p>
        )}
      </ModelsSection>

      {suite && (
        <ModelsSection
          title="Comparison"
          description="Latest run per route. Select a row to read its answers."
        >
          <EvalComparison
            suite={suite}
            runs={runs.data ?? []}
            routes={(routes.data ?? []).map((route) => ({
              id: route.id,
              label: route.displayName,
              detail: `${route.provider} · ${route.region}`,
            }))}
            onOpenRun={(item) => setSelectedRunId(item.id)}
          />
        </ModelsSection>
      )}

      {suite && selectedRunId && (
        <ModelsSection title="Case results">
          {caseResults.isLoading ? (
            <CardSkeleton />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {(caseResults.data ?? []).map((result) => {
                const item = suite.cases.find((candidate) => candidate.id === result.caseId);

                return (
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
                    <p className="font-medium">{item?.input}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {result.error ?? result.output}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </ModelsSection>
      )}

      <CreateSuiteDialog
        open={creating}
        onOpenChange={setCreating}
        workspaceId={workspaceId}
        projectId={projectId}
      />
    </div>
  );
}
