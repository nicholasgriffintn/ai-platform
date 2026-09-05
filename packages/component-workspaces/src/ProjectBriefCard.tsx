import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import { Pencil } from "lucide-react";
import { useEffect, useId, useState } from "react";

export interface ProjectBriefCardProps {
  canManage: boolean;
  embedded?: boolean;
  instructions: string;
  isSaving?: boolean;
  errorMessage?: string;
  onSave: (instructions: string) => Promise<void> | void;
}

export function ProjectBriefCard({
  canManage,
  embedded = false,
  instructions,
  isSaving = false,
  errorMessage,
  onSave,
}: ProjectBriefCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(instructions);
  const briefId = useId();

  useEffect(() => setDraft(instructions), [instructions]);

  const cancel = () => {
    setDraft(instructions);
    setIsEditing(false);
  };

  const save = async () => {
    await onSave(draft);
    setIsEditing(false);
  };

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-creative/12 p-2 text-creative">
            <Pencil size={17} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Project brief</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shared instructions for every project conversation.
            </p>
          </div>
        </div>
        {canManage && !isEditing && (
          <Button
            variant="icon"
            icon={<Pencil size={15} />}
            onClick={() => setIsEditing(true)}
            aria-label={instructions ? "Edit project brief" : "Add project brief"}
            title={instructions ? "Edit project brief" : "Add project brief"}
          />
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <label htmlFor={briefId} className="sr-only">
            Project brief
          </label>
          <textarea
            id={briefId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={8000}
            rows={8}
            autoFocus
            placeholder="Add project context, terminology, constraints, and working preferences."
            className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-6 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-active-work/40"
          />
          {errorMessage && (
            <p role="alert" className="text-sm text-failure">
              {errorMessage}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={cancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={isSaving}>
              {isSaving ? "Saving…" : "Save brief"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap pl-11 text-sm leading-6 text-muted-foreground">
          {instructions ||
            (canManage
              ? "Add instructions to give every project conversation the same context."
              : "No project instructions have been added.")}
        </p>
      )}
    </>
  );

  return embedded ? (
    <section className="space-y-4 p-5">{content}</section>
  ) : (
    <Card className="gap-4 p-5 shadow-none">{content}</Card>
  );
}
