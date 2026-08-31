import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { getNumberInputValue, parseNumberInputValue } from "@ngriffin_uk/polychat-utility-core";

import { AgentEditorSection } from "./AgentEditorSection";
import type { AgentEditorChange, AgentEditorValue } from "./types";

export interface ModelSectionProps {
  value: Pick<AgentEditorValue, "model" | "temperature" | "maxSteps">;
  models: ModelConfig;
  disabled: boolean;
  onChange: AgentEditorChange;
}

export function ModelSection({ value, models, disabled, onChange }: ModelSectionProps) {
  const modelOptions = Object.entries(models)
    .filter(([, model]) => model.supportsToolCalls)
    .map(([id, model]) => ({ value: id, label: model.name || id }));

  return (
    <AgentEditorSection
      title="Model"
      description="Pin a model and how far it is allowed to wander before it stops."
    >
      <FormSelect
        label="Model"
        value={value.model}
        disabled={disabled}
        options={[{ value: "", label: "Use the chat default" }, ...modelOptions]}
        description="Only models that support tool calls can run an agent."
        onChange={(event) => onChange({ model: event.target.value })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          label="Temperature"
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={getNumberInputValue(value.temperature)}
          disabled={disabled}
          description="Lower is steadier, higher is more inventive."
          onChange={(event) => onChange({ temperature: parseNumberInputValue(event.target.value) })}
        />
        <FormInput
          label="Max steps"
          type="number"
          min="1"
          max="50"
          step="1"
          value={getNumberInputValue(value.maxSteps)}
          disabled={disabled}
          description="A hard ceiling on tool calls per turn, within the mode's budget."
          onChange={(event) =>
            onChange({
              maxSteps: parseNumberInputValue(event.target.value, { integer: true }),
            })
          }
        />
      </div>
    </AgentEditorSection>
  );
}
