import { Button, Card, FormInput, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";

import {
  replaceAuthoredSkillInstructions,
  splitAuthoredSkillDocument,
} from "~/lib/authored-skill-document";

interface SkillDraftPanelProps {
  content: string;
  description: string;
  changeNote: string;
  isDirty: boolean;
  isDraftLive: boolean;
  isSaving: boolean;
  isPromoting: boolean;
  latestOutcome?: "passed" | "failed" | "unscored";
  onChange: (content: string) => void;
  onChangeNote: (note: string) => void;
  onSave: () => Promise<unknown>;
  onPromote: () => Promise<unknown>;
}

export function SkillDraftPanel(props: SkillDraftPanelProps) {
  const instructions = splitAuthoredSkillDocument(props.content).instructions;
  const readiness = props.isDraftLive
    ? "Live revision"
    : props.latestOutcome === "passed"
      ? "Draft evaluated successfully"
      : props.latestOutcome === "failed"
        ? "Draft evaluation needs attention"
        : "Draft ready for review";

  return (
    <Card className="gap-4 p-6 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Draft</h2>
          <p className="text-sm text-zinc-500">{readiness}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!props.isDirty || !instructions.trim()}
            isLoading={props.isSaving}
            onClick={() => void props.onSave()}
          >
            Save draft
          </Button>
          <Button
            variant="primary"
            disabled={props.isDirty || props.isDraftLive}
            isLoading={props.isPromoting}
            onClick={() => void props.onPromote()}
          >
            Make live
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
        <span className="font-medium">When to use this skill</span>
        <p className="mt-1 text-zinc-600 dark:text-zinc-300">{props.description}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-instructions">Instructions</Label>
        <Textarea
          id="skill-instructions"
          value={instructions}
          onChange={(event) =>
            props.onChange(replaceAuthoredSkillInstructions(props.content, event.target.value))
          }
          rows={16}
          placeholder="Describe what the assistant should do."
        />
      </div>

      <FormInput
        label="Change note"
        description="Optional context for revision history."
        value={props.changeNote}
        maxLength={1024}
        onChange={(event) => props.onChangeNote(event.target.value)}
      />
    </Card>
  );
}
