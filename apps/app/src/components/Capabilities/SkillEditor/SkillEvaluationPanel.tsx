import { Button, Card, FormInput, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type {
  AuthoredSkillEvaluationCase,
  AuthoredSkillEvaluationCaseInput,
  AuthoredSkillEvaluationResult,
  AuthoredSkillEvaluationRunInput,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

interface SkillEvaluationPanelProps {
  cases: AuthoredSkillEvaluationCase[];
  results: AuthoredSkillEvaluationResult[];
  revisionNumber?: number;
  isCreatingCase: boolean;
  isDeletingCase: boolean;
  isRunning: boolean;
  onCreateCase: (input: AuthoredSkillEvaluationCaseInput) => Promise<unknown>;
  onDeleteCase: (caseId: string) => Promise<unknown>;
  onRun: (input: Omit<AuthoredSkillEvaluationRunInput, "revisionId">) => Promise<unknown>;
}

export function SkillEvaluationPanel(props: SkillEvaluationPanelProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expectedContains, setExpectedContains] = useState("");
  const [model, setModel] = useState("");

  const createCase = async () => {
    await props.onCreateCase({
      name,
      prompt,
      ...(expectedContains.trim() ? { expectedContains: expectedContains.trim() } : {}),
    });
    setName("");
    setPrompt("");
    setExpectedContains("");
  };

  const runPrompt = async () => {
    await props.onRun({
      prompt,
      ...(expectedContains.trim() ? { expectedContains: expectedContains.trim() } : {}),
      ...(model.trim() ? { model: model.trim() } : {}),
    });
  };

  return (
    <Card className="gap-6 p-6 shadow-none">
      <div>
        <h2 className="text-lg font-semibold">Test draft</h2>
        <p className="text-sm text-zinc-500">
          Run revision {props.revisionNumber ?? "…"} in isolation. Live conversations are unchanged.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormInput
          label="Case name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FormInput
          label="Expected response contains"
          value={expectedContains}
          onChange={(event) => setExpectedContains(event.target.value)}
          description="Optional. Matching is exact and case-sensitive."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="evaluation-prompt">Test prompt</Label>
        <Textarea
          id="evaluation-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={5}
        />
      </div>
      <FormInput
        label="Model"
        value={model}
        onChange={(event) => setModel(event.target.value)}
        description="Optional. Leave blank to use automatic routing."
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!prompt.trim()}
          isLoading={props.isRunning}
          onClick={() => void runPrompt()}
        >
          Run once
        </Button>
        <Button
          variant="outline"
          disabled={!name.trim() || !prompt.trim()}
          isLoading={props.isCreatingCase}
          onClick={() => void createCase()}
        >
          Save as repeatable case
        </Button>
      </div>

      {props.cases.length > 0 && (
        <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="font-medium">Saved cases</h3>
          {props.cases.map((evaluationCase) => (
            <div
              key={evaluationCase.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{evaluationCase.name}</p>
                <p className="truncate text-sm text-zinc-500">{evaluationCase.prompt}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={props.isRunning}
                  onClick={() =>
                    void props.onRun({
                      caseId: evaluationCase.id,
                      ...(model.trim() ? { model: model.trim() } : {}),
                    })
                  }
                >
                  Run
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={props.isDeletingCase}
                  onClick={() => void props.onDeleteCase(evaluationCase.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {props.results.length > 0 && (
        <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="font-medium">Recent results</h3>
          {props.results.map((result) => (
            <details
              key={result.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <summary className="cursor-pointer text-sm font-medium">
                Revision {result.revision} · {result.model} · {result.outcome}
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-zinc-500">
                  Author {result.createdByUserId} · {new Date(result.createdAt).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Prompt:</span> {result.prompt}
                </p>
                {result.expectedContains && (
                  <p>
                    <span className="font-medium">Expected:</span> contains “
                    {result.expectedContains}”
                  </p>
                )}
                <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                  {result.response}
                </pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}
