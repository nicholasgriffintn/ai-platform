import {
  FormDialog,
  FormInput,
  FormSelect,
  SingleFileUploader,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  describePetSheetSizes,
  PET_DESCRIPTION_MAX_LENGTH,
  PET_SHEET_MAX_BYTES,
  selectPetSheetLayout,
  type PetSheetLayoutSelection,
} from "@ngriffin_uk/polychat-schemas";
import { readImageDimensions } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export interface PetUploadSubmission {
  name: string;
  description: string;
  layoutId: string;
  sheet: File;
}

async function readSheetSelection(file: File): Promise<PetSheetLayoutSelection> {
  const dimensions = readImageDimensions(new Uint8Array(await file.arrayBuffer()));

  return dimensions
    ? selectPetSheetLayout(dimensions.width, dimensions.height)
    : { kind: "unknown-size" };
}

function sheetHint(selection: PetSheetLayoutSelection | null): string | null {
  if (!selection) {
    return null;
  }

  if (selection.kind === "unknown-size") {
    return `That sheet is not ${describePetSheetSizes()} pixels.`;
  }

  if (selection.kind === "ambiguous") {
    return "Two layouts share this size. Pick the one the sheet was drawn for.";
  }

  return null;
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
  const [selection, setSelection] = useState<PetSheetLayoutSelection | null>(null);
  const [layoutId, setLayoutId] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);

    if (!open) {
      setName("");
      setDescription("");
      setSheet(null);
      setSelection(null);
      setLayoutId("");
    }
  }

  const chooseSheetLayout = async (file: File) => {
    const nextSelection = await readSheetSelection(file);

    setSelection(nextSelection);
    setLayoutId(nextSelection.kind === "selected" ? nextSelection.layout.id : "");
  };

  const candidates = selection?.kind === "ambiguous" ? selection.candidates : [];
  const hint = sheetHint(selection);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload a pet"
      description="Add an animated companion of your own."
      submitText="Upload"
      isLoading={isSaving}
      submitDisabled={!sheet || !layoutId || name.trim().length === 0}
      onSubmit={() => {
        if (!sheet || !layoutId) {
          return;
        }

        onSubmit({ name: name.trim(), description: description.trim(), layoutId, sheet });
      }}
    >
      <div className="space-y-2">
        <label htmlFor="pet_upload_name" className="block text-sm font-medium text-foreground">
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
          className="block text-sm font-medium text-foreground"
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
        <p className="text-xs text-muted-foreground">
          Up to {PET_DESCRIPTION_MAX_LENGTH} characters.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="pet_upload_sheet" className="block text-sm font-medium text-foreground">
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

            const file = next instanceof File ? next : null;

            setSheet(file);
            setSelection(null);
            setLayoutId("");

            if (file) {
              void chooseSheetLayout(file);
            }
          }}
        />
        {candidates.length > 0 ? (
          <FormSelect
            id="pet_upload_layout"
            name="pet_upload_layout"
            label="Sheet layout"
            options={candidates.map((candidate) => ({
              value: candidate.id,
              label: candidate.label,
            }))}
            value={layoutId}
            placeholder="Choose a layout"
            onValueChange={setLayoutId}
          />
        ) : null}
        {hint ? <p className="text-xs text-human-action">{hint}</p> : null}
        <p className="text-xs text-muted-foreground">
          Eight columns of 192 by 208 frames, one row per animation. Polychat sheets have eleven
          rows. Codex sheets have nine, or eleven when they add look directions.
        </p>
      </div>

      {error ? <p className="text-sm text-failure">{error}</p> : null}
    </FormDialog>
  );
}
