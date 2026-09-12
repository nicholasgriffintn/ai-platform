import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage, useCreateTeachingSkillDraft } from "@ngriffin_uk/polychat-library-react";
import { slugify, splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function TeammateTeachingDraft({
  contextId,
  recordingId,
  computerFence,
}: {
  contextId: string;
  recordingId: string;
  computerFence: number;
}) {
  const createDraft = useCreateTeachingSkillDraft();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState(false);
  const steps = splitNonEmptyLines(instructions);

  const save = async () => {
    try {
      await createDraft.mutateAsync({
        teammateContextId: contextId,
        recordingId,
        computerFence,
        name: slugify(name, 64),
        description,
        steps,
      });
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto border-l bg-background p-4 lg:w-80">
      <div>
        <p className="text-sm font-medium text-foreground">Teach this workflow</p>
        <p className="text-xs text-muted-foreground">
          Recording is active. Demonstrate the workflow and a disabled draft will be created from
          the redacted interaction sequence. Coordinates, typed values and account details are
          discarded.
        </p>
      </div>
      <label className="space-y-1 text-xs text-muted-foreground">
        Skill name
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
          placeholder="prepare-weekly-report"
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        When should it be used?
        <Textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setSaved(false);
          }}
          placeholder="Use when preparing the weekly report from…"
          rows={3}
        />
      </label>
      <label className="min-h-0 flex-1 space-y-1 text-xs text-muted-foreground">
        Reviewer refinements (optional)
        <Textarea
          className="min-h-48"
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value);
            setSaved(false);
          }}
          placeholder="Add semantic detail that cannot be inferred safely from the recording…"
          rows={10}
        />
      </label>
      {createDraft.error ? (
        <p className="text-xs text-destructive">
          {getErrorMessage(createDraft.error, "The teaching draft could not be saved.")}
        </p>
      ) : null}
      {saved ? (
        <p className="text-xs text-muted-foreground">
          Saved as a disabled draft. Review and publish it from Skills when ready.
        </p>
      ) : null}
      <Button
        type="button"
        variant="primary"
        disabled={!slugify(name, 64) || !description.trim()}
        isLoading={createDraft.isPending}
        onClick={() => void save()}
      >
        Save draft for review
      </Button>
    </div>
  );
}
