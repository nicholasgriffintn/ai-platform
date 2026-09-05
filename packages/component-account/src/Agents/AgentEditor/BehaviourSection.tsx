import { Button, Label, Textarea, cn } from "@ngriffin_uk/polychat-component-ui";
import type { AgentMode } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Plus, Trash2 } from "lucide-react";

import { AGENT_MODES, describeAgentMode, getAgentModeLabel } from "./agent-mode-summary";
import { AgentEditorSection } from "./AgentEditorSection";
import type { AgentEditorChange, AgentEditorValue } from "./types";

export interface BehaviourSectionProps {
  value: Pick<AgentEditorValue, "systemPrompt" | "examples" | "mode">;
  disabled: boolean;
  onChange: AgentEditorChange;
}

const INHERIT_MODE_VALUE = "inherit";

export function BehaviourSection({ value, disabled, onChange }: BehaviourSectionProps) {
  const modeOptions: Array<{ value: string; mode: AgentMode | null; label: string; hint: string }> =
    [
      {
        value: INHERIT_MODE_VALUE,
        mode: null,
        label: "Follow the conversation",
        hint: "Whatever mode the person is already in wins.",
      },
      ...AGENT_MODES.map((mode) => ({
        value: mode,
        mode,
        label: getAgentModeLabel(mode),
        hint: describeAgentMode(mode),
      })),
    ];

  return (
    <AgentEditorSection
      title="Behaviour"
      description="What the agent is told before anyone speaks to it, and how much rope it gets."
    >
      <div className="space-y-2">
        <Label htmlFor="agent-system-prompt">System prompt</Label>
        <Textarea
          id="agent-system-prompt"
          rows={6}
          value={value.systemPrompt}
          disabled={disabled}
          placeholder="You are a research assistant. Always cite your sources..."
          onChange={(event) => onChange({ systemPrompt: event.target.value })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Mode</legend>
        <p className="text-xs text-muted-foreground">
          A mode sets the step budget and which tool permissions need approval.
        </p>
        <div className="space-y-2">
          {modeOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="agent-mode"
                className="mt-1"
                value={option.value}
                disabled={disabled}
                checked={(value.mode ?? INHERIT_MODE_VALUE) === option.value}
                onChange={() => onChange({ mode: option.mode })}
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <div>
          <Label>Examples</Label>
          <p className="text-xs text-muted-foreground">
            Optional pairs showing the agent how a good exchange goes.
          </p>
        </div>

        {value.examples.map((example, index) => (
          <div key={example.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground text-sm font-medium">Example {index + 1}</h3>
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
                placeholder="How the agent should answer..."
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
    </AgentEditorSection>
  );
}
