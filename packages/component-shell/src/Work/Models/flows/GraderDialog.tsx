import {
  FormDialog,
  FormInput,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import { useModelPlatformMutations } from "@ngriffin_uk/polychat-library-react";
import { GRADER_KINDS, type GraderConfig, type GraderKind } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";

const KIND_LABELS: Record<GraderKind, string> = {
  exact: "Matches the reference exactly",
  contains: "Contains the reference",
  regex: "Matches a pattern",
  json_schema: "Valid JSON with required keys",
  numeric: "Numeric answer within a tolerance",
  judge: "Scored against a rubric by a judge model",
};

function configFor(kind: GraderKind, detail: string): GraderConfig {
  switch (kind) {
    case "exact":
    case "contains":
      return { kind };
    case "regex":
      return { kind, pattern: detail };
    case "json_schema":
      return {
        kind,
        requiredKeys: detail
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean),
      };
    case "numeric":
      return { kind, tolerance: Number(detail) || 0 };
    default:
      return { kind: "judge", rubric: detail, judgeModelId: null };
  }
}

const DETAIL_LABELS: Partial<Record<GraderKind, string>> = {
  regex: "Pattern",
  json_schema: "Required keys, comma separated",
  numeric: "Tolerance",
  judge: "Rubric",
};

export function GraderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, projectId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("");
  const [kind, setKind] = useState<GraderKind>("contains");
  const [detail, setDetail] = useState("");
  const needsDetail = DETAIL_LABELS[kind] !== undefined;

  const submit = async () => {
    const grader = await runWithToast("Grader saved", () =>
      mutations.createGrader.mutateAsync({
        projectId: projectId ?? null,
        name,
        metric,
        config: configFor(kind, detail),
      }),
    );

    if (grader) {
      onOpenChange(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New grader"
      description="One grader scores eval suites, rewards reinforcement training and gates alias promotions, so all three agree."
      onSubmit={submit}
      submitText="Save grader"
      isLoading={mutations.createGrader.isPending}
      submitDisabled={
        !name.trim() || !/^[a-z0-9_]+$/.test(metric) || (needsDetail && !detail.trim())
      }
    >
      <div className="space-y-3">
        <FormInput
          label="Name"
          placeholder="Correct answer"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FormInput
          label="Metric"
          placeholder="correct"
          description="Lowercase letters, digits and underscores."
          value={metric}
          onChange={(event) => setMetric(event.target.value)}
        />
        <FormSelect
          label="How it scores"
          value={kind}
          onValueChange={setKind}
          options={GRADER_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
        />
        {needsDetail &&
          (kind === "judge" ? (
            <FormTextarea
              label="Rubric"
              placeholder="Score 5 for a correct, courteous, complete reply."
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          ) : (
            <FormInput
              label={DETAIL_LABELS[kind]}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          ))}
      </div>
    </FormDialog>
  );
}
