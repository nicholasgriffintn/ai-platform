import { Button, FormRadioGroup, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Plus, Trash2 } from "lucide-react";

import { AGENT_MODES, describeAgentMode, getAgentModeLabel } from "./agent-mode-summary";
import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface BehaviourSectionProps {
  value: Pick<TeammateEditorValue, "systemPrompt" | "examples" | "mode">;
  disabled: boolean;
  onChange: TeammateEditorChange;
}

const INHERIT_MODE_VALUE = "inherit";

export function BehaviourSection({ value, disabled, onChange }: BehaviourSectionProps) {
  const modeOptions = [
    {
      value: INHERIT_MODE_VALUE,
      label: "Follow the conversation",
      description: "Whatever mode the person is already in wins.",
    },
    ...AGENT_MODES.map((mode) => ({
      value: mode,
      label: getAgentModeLabel(mode),
      description: describeAgentMode(mode),
    })),
  ];

  return (
    <TeammateEditorSection
      title="Behaviour"
      description="What the teammate is told before anyone speaks to it, and how much rope it gets."
    >
      <div className="space-y-2">
        <Label htmlFor="teammate-system-prompt">System prompt</Label>
        <Textarea
          id="teammate-system-prompt"
          rows={6}
          value={value.systemPrompt}
          disabled={disabled}
          placeholder="You are a research assistant. Always cite your sources..."
          onChange={(event) => onChange({ systemPrompt: event.target.value })}
        />
      </div>

      <FormRadioGroup
        legend="Mode"
        description="A mode sets the step budget and which tool permissions need approval."
        name="teammate-mode"
        disabled={disabled}
        value={value.mode ?? INHERIT_MODE_VALUE}
        options={modeOptions}
        onValueChange={(selected) =>
          onChange({ mode: AGENT_MODES.find((mode) => mode === selected) ?? null })
        }
      />

      <div className="space-y-3">
        <div>
          <Label>Examples</Label>
          <p className="text-xs text-muted-foreground">
            Optional pairs showing the teammate how a good exchange goes.
          </p>
        </div>

        {value.examples.map((example, index) => (
          <div key={example.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Example {index + 1}</h3>
              <Button
                variant="destructive"
                size="icon"
                type="button"
                disabled={disabled}
                aria-label={`Remove example ${index + 1}`}
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() =>
                  onChange({
                    examples: value.examples.filter((entry) => entry.id !== example.id),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`example-input-${example.id}`}>Prompt</Label>
              <Textarea
                id={`example-input-${example.id}`}
                rows={2}
                value={example.input}
                disabled={disabled}
                placeholder="What someone might ask..."
                onChange={(event) =>
                  onChange({
                    examples: value.examples.map((entry) =>
                      entry.id === example.id ? { ...entry, input: event.target.value } : entry,
                    ),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`example-output-${example.id}`}>Reply</Label>
              <Textarea
                id={`example-output-${example.id}`}
                rows={2}
                value={example.output}
                disabled={disabled}
                placeholder="How the teammate should answer..."
                onChange={(event) =>
                  onChange({
                    examples: value.examples.map((entry) =>
                      entry.id === example.id ? { ...entry, output: event.target.value } : entry,
                    ),
                  })
                }
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          icon={<Plus className="h-4 w-4" />}
          onClick={() =>
            onChange({
              examples: [...value.examples, { id: generateId(), input: "", output: "" }],
            })
          }
        >
          Add example
        </Button>
      </div>
    </TeammateEditorSection>
  );
}
