import {
  FormDialog,
  FormInput,
  FormSection,
  FormTextarea,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import { parseEvalCaseLines } from "@ngriffin_uk/polychat-library-model-registry";
import { useGraders, useModelPlatformMutations } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";

export function CreateSuiteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, projectId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const graders = useGraders(workspaceId, projectId);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [casesText, setCasesText] = useState("");
  const [graderIds, setGraderIds] = useState<string[]>([]);
  const parsed = parseEvalCaseLines(casesText);

  const submit = async () => {
    const suite = await runWithToast("Suite saved", () =>
      mutations.createSuite.mutateAsync({
        projectId: projectId ?? null,
        name,
        systemPrompt: systemPrompt || undefined,
        cases: parsed.cases,
        graderIds,
        replaySampleSize: Math.min(50, parsed.cases.length),
      }),
    );

    if (suite) {
      onOpenChange(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New eval suite"
      description="Real questions from your own work, scored by the graders you choose."
      onSubmit={submit}
      submitText="Save suite"
      isLoading={mutations.createSuite.isPending}
      submitDisabled={
        !name.trim() ||
        parsed.cases.length === 0 ||
        parsed.errors.length > 0 ||
        graderIds.length === 0
      }
    >
      <div className="space-y-5">
        <FormSection title="Cases">
          <FormInput
            label="Name"
            placeholder="Support questions"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FormTextarea
            label="System prompt (optional)"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            className="min-h-16"
          />
          <FormTextarea
            label="Questions and expected answers"
            description={
              parsed.errors.length > 0
                ? parsed.errors.join("; ")
                : `${parsed.cases.length} case${parsed.cases.length === 1 ? "" : "s"}. One per line as question => answer, or JSON lines with input and expected.`
            }
            value={casesText}
            onChange={(event) => setCasesText(event.target.value)}
            className="min-h-40 font-mono text-xs"
            placeholder="How do I reset my password? => Settings, then Security"
          />
        </FormSection>
        <FormSection title="Graders" description="Each grader adds a metric to the comparison.">
          {(graders.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a grader first; suites score with graders.
            </p>
          ) : (
            <div className="space-y-3">
              {(graders.data ?? []).map((grader) => (
                <Switch
                  key={grader.id}
                  label={grader.name}
                  description={`Scores ${grader.metric} · ${grader.config.kind.replace("_", " ")}`}
                  checked={graderIds.includes(grader.id)}
                  onChange={(event) =>
                    setGraderIds((current) =>
                      event.target.checked
                        ? [...current, grader.id]
                        : current.filter((id) => id !== grader.id),
                    )
                  }
                />
              ))}
            </div>
          )}
        </FormSection>
      </div>
    </FormDialog>
  );
}
