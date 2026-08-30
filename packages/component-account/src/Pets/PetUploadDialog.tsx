import {
  FormDialog,
  FormInput,
  SingleFileUploader,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  describePetSheetSizes,
  PET_DESCRIPTION_MAX_LENGTH,
  PET_SHEET_MAX_BYTES,
} from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";

export interface PetUploadSubmission {
  name: string;
  description: string;
  sheet: File;
}

export interface PetUploadDialogProps {
  open: boolean;
  isSaving: boolean;
  error?: string | null;
  maxMebibytes: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (submission: PetUploadSubmission) => void;
}

export function PetUploadDialog({
  open,
  isSaving,
  error = null,
  maxMebibytes,
  onOpenChange,
  onSubmit,
}: PetUploadDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sheet, setSheet] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setSheet(null);
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload a pet"
      description="Add an animated companion of your own."
      submitText="Upload"
      isLoading={isSaving}
      submitDisabled={!sheet || name.trim().length === 0}
      onSubmit={() => {
        if (!sheet) {
          return;
        }

        onSubmit({ name: name.trim(), description: description.trim(), sheet });
      }}
    >
      <div className="space-y-2">
        <label
          htmlFor="pet_upload_name"
          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Pet name
        </label>
        <FormInput
          id="pet_upload_name"
          name="pet_upload_name"
          value={name}
          placeholder="Name your pet"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="pet_upload_description"
          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Pet description (optional)
        </label>
        <Textarea
          id="pet_upload_description"
          name="pet_upload_description"
          value={description}
          rows={3}
          maxLength={PET_DESCRIPTION_MAX_LENGTH}
          placeholder="Describe your pet"
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Up to {PET_DESCRIPTION_MAX_LENGTH} characters.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="pet_upload_sheet"
          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Sprite sheet
        </label>
        <SingleFileUploader
          id="pet_upload_sheet"
          accept="image/png,image/webp"
          maxSize={PET_SHEET_MAX_BYTES}
          label="Drop a sprite sheet"
          hint={`Transparent PNG or WebP, ${describePetSheetSizes()} pixels, up to ${maxMebibytes} MiB`}
          onFilesChange={(files) => {
            const next = files[0]?.file;

            setSheet(next instanceof File ? next : null);
          }}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Eight columns of 192 by 208 frames, one row per animation. Polychat sheets have eleven
          rows; Codex sheets have nine and reuse the rows they share.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </FormDialog>
  );
}
