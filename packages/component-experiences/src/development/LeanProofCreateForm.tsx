import {
  Button,
  ButtonLink,
  Card,
  FormInput,
  Label,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  LEAN_PROOF_MAX_TOKEN_BUDGET,
  leanProofRequestSchema,
  type CreateLeanProofProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";
import { GitBranch, Play, ShieldAlert } from "lucide-react";
import { useId, useState } from "react";

import { splitLeanProofLines } from "./presentation";

export interface LeanProofCreateFormProps {
  repository: string | null;
  repositorySettingsHref: string;
  isSubmitting?: boolean;
  serverError?: string | null;
  onSubmit: (input: CreateLeanProofProjectTaskInput) => Promise<void> | void;
}

const DEFAULT_TOKEN_BUDGET = 200_000;

export function LeanProofCreateForm({
  repository,
  repositorySettingsHref,
  isSubmitting = false,
  serverError,
  onSubmit,
}: LeanProofCreateFormProps) {
  const [targetPaths, setTargetPaths] = useState("");
  const [declarations, setDeclarations] = useState("");
  const [objective, setObjective] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [tokenBudget, setTokenBudget] = useState(String(DEFAULT_TOKEN_BUDGET));
  const [validationError, setValidationError] = useState<string | null>(null);
  const targetPathsId = useId();
  const declarationsId = useId();
  const objectiveId = useId();
  const criteriaId = useId();

  if (!repository) {
    return (
      <Card className="overflow-hidden border-amber-300 bg-amber-50/70 p-0 shadow-none dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              <ShieldAlert size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Connect a coding repository first
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-amber-800 dark:text-amber-200/80">
                Lean Proofs runs inside the project’s isolated coding environment. Repository access
                remains controlled by the project configuration.
              </p>
            </div>
          </div>
          <ButtonLink href={repositorySettingsHref} variant="outline" size="sm">
            Configure project
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const request = {
      targetPaths: splitLeanProofLines(targetPaths),
      declarations: splitLeanProofLines(declarations),
      objective,
      acceptanceCriteria: splitLeanProofLines(acceptanceCriteria),
    };
    const parsedRequest = leanProofRequestSchema.safeParse(request);
    const parsedBudget = Number(tokenBudget);

    if (!parsedRequest.success) {
      setValidationError(parsedRequest.error.issues[0]?.message ?? "Check the proof request.");

      return;
    }

    if (
      !Number.isInteger(parsedBudget) ||
      parsedBudget < 1 ||
      parsedBudget > LEAN_PROOF_MAX_TOKEN_BUDGET
    ) {
      setValidationError(
        `Token budget must be a whole number between 1 and ${LEAN_PROOF_MAX_TOKEN_BUDGET.toLocaleString()}.`,
      );

      return;
    }

    setValidationError(null);
    void Promise.resolve(onSubmit({ ...parsedRequest.data, tokenBudget: parsedBudget })).catch(
      () => undefined,
    );
  };

  const errorMessage = validationError ?? serverError;

  return (
    <Card className="overflow-hidden p-0 shadow-none">
      <div className="border-b border-zinc-200 bg-zinc-950 px-5 py-4 text-white dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-emerald-300 uppercase">
              New proof run
            </p>
            <h2 className="mt-1 text-base font-semibold">Set a precise proof target</h2>
          </div>
          <p className="flex max-w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-zinc-200">
            <GitBranch size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{repository}</span>
          </p>
        </div>
      </div>

      <form className="grid gap-5 p-5 lg:grid-cols-2" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor={objectiveId}>Objective</Label>
          <Textarea
            id={objectiveId}
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Prove that the normalisation step preserves the invariant…"
            rows={4}
            maxLength={4000}
            required
            disabled={isSubmitting}
          />
          <p className="text-xs text-zinc-500">Describe the theorem and the intended boundary.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={targetPathsId}>Target Lean files</Label>
          <Textarea
            id={targetPathsId}
            value={targetPaths}
            onChange={(event) => setTargetPaths(event.target.value)}
            placeholder={"Mathlib/Algebra/Example.lean\nMyProject/Theorem.lean"}
            rows={4}
            required
            disabled={isSubmitting}
            className="font-mono text-xs"
          />
          <p className="text-xs text-zinc-500">One repository-relative .lean path per line.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={declarationsId}>Declarations to verify</Label>
          <Textarea
            id={declarationsId}
            value={declarations}
            onChange={(event) => setDeclarations(event.target.value)}
            placeholder={"MyProject.Theorem.main\nMyProject.Theorem.helper"}
            rows={4}
            disabled={isSubmitting}
            className="font-mono text-xs"
          />
          <p className="text-xs text-zinc-500">
            Optional. Add qualified names to request declaration-level kernel evidence.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={criteriaId}>Acceptance criteria</Label>
          <Textarea
            id={criteriaId}
            value={acceptanceCriteria}
            onChange={(event) => setAcceptanceCriteria(event.target.value)}
            placeholder={"No sorry or admit placeholders\nExisting tests continue to pass"}
            rows={3}
            disabled={isSubmitting}
          />
          <p className="text-xs text-zinc-500">Optional. One observable criterion per line.</p>
        </div>

        <FormInput
          label="Token budget"
          type="number"
          min={1}
          max={LEAN_PROOF_MAX_TOKEN_BUDGET}
          step={1000}
          value={tokenBudget}
          onChange={(event) => setTokenBudget(event.target.value)}
          description="The run stops when this model budget is exhausted."
          disabled={isSubmitting}
        />

        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 lg:col-span-2">
          <div aria-live="polite">
            {errorMessage ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {errorMessage}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                The agent may edit target files and create a commit when the project allows it.
              </p>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Play size={14} aria-hidden="true" />}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Start proof run
          </Button>
        </div>
      </form>
    </Card>
  );
}
