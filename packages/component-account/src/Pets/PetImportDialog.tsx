import { FormDialog, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

export interface PetImportDialogProps {
  open: boolean;
  isImporting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
}

export function PetImportDialog({
  open,
  isImporting,
  error = null,
  onOpenChange,
  onSubmit,
}: PetImportDialogProps) {
  const [url, setUrl] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);

    if (!open) {
      setUrl("");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import a pet"
      description="Bring in a Codex or Polychat pet from the address of its pet.json."
      submitText="Import"
      isLoading={isImporting}
      submitDisabled={url.trim().length === 0}
      onSubmit={() => onSubmit(url.trim())}
    >
      <FormInput
        id="pet_import_url"
        name="pet_import_url"
        type="url"
        label="pet.json address"
        value={url}
        placeholder="https://example.com/pets/pocket-rice/pet.json"
        description="The sprite sheet is read from beside it, or from the path the manifest names."
        onChange={(event) => setUrl(event.target.value)}
      />
      {error ? <p className="text-sm text-failure">{error}</p> : null}
    </FormDialog>
  );
}
