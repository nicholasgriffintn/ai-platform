import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { getNumberInputValue, parseNumberInputValue } from "@ngriffin_uk/polychat-utility-core";

import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface ModelSectionProps {
  value: Pick<TeammateEditorValue, "model" | "temperature" | "maxSteps">;
  models: ModelConfig;
  disabled: boolean;
  onChange: TeammateEditorChange;
}

export function ModelSection({ value, models, disabled, onChange }: ModelSectionProps) {
  const modelOptions = Object.entries(models)
    .filter(([, model]) => model.supportsToolCalls)
    .map(([id, model]) => ({ value: id, label: model.name || id }));

  return (
    <TeammateEditorSection
      title="Model"
      description="Pin a model and how far it is allowed to wander before it stops."
    >
      <FormSelect
        label="Model"
        value={value.model}
        disabled={disabled}
        options={[{ value: "", label: "Use the chat default" }, ...modelOptions]}
        description="Only models that support tool calls can run a teammate."
        onValueChange={(model) => onChange({ model })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          label="Temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
          value={getNumberInputValue(value.temperature)}
          disabled={disabled}
          placeholder="Automatic"
          description="Leave blank to use automatic sampling."
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
    </TeammateEditorSection>
  );
}
