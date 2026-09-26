import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { useEvalSuites, useGraders } from "@ngriffin_uk/polychat-library-react";
import type { AliasGate } from "@ngriffin_uk/polychat-schemas";

import { useModelsScope } from "../ModelsScope.js";

export function AliasGateFields({
  gate,
  onChange,
}: {
  gate: AliasGate | null;
  onChange: (gate: AliasGate | null) => void;
}) {
  const { workspaceId, projectId } = useModelsScope();
  const suites = useEvalSuites(workspaceId, projectId);
  const graders = useGraders(workspaceId, projectId);
  const suite = suites.data?.find((item) => item.id === gate?.suiteId);
  const metrics = (graders.data ?? [])
    .filter((grader) => suite?.graderIds.includes(grader.id))
    .map((grader) => grader.metric);

  return (
    <div className="space-y-2">
      <FormSelect
        label="Promotion gate"
        value={gate?.suiteId ?? "none"}
        onValueChange={(suiteId) =>
          onChange(suiteId === "none" ? null : { suiteId, thresholds: {} })
        }
        options={[
          { value: "none", label: "No gate" },
          ...(suites.data ?? []).map((item) => ({ value: item.id, label: `Pass ${item.name}` })),
        ]}
      />
      {gate && metrics.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {metrics.map((metric) => (
            <FormInput
              key={metric}
              label={`Minimum ${metric} (%)`}
              type="number"
              value={Math.round((gate.thresholds[metric] ?? 0) * 100)}
              onChange={(event) =>
                onChange({
                  ...gate,
                  thresholds: {
                    ...gate.thresholds,
                    [metric]: Math.min(100, Math.max(0, Number(event.target.value) || 0)) / 100,
                  },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
