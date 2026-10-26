import { FormDialog, FormInput, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import type { SaveTeamTemplateInput } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function SaveTeamTemplateDialog({
  open,
  defaultName,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  defaultName: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: SaveTeamTemplateInput) => Promise<unknown>;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Save the team as a template"
      description="Keeps the projects, initiatives, teammates, reporting lines, budgets and routines. Tasks and connected services stay here. New workspaces can start from it."
      submitText="Save template"
      isLoading={isSaving}
      submitDisabled={!name.trim()}
      onSubmit={async () => {
        await onSubmit({ name: name.trim(), description: description.trim() });
        onOpenChange(false);
      }}
    >
      <div className="space-y-4">
        <FormInput label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <FormTextarea
          label="What it is for"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}
