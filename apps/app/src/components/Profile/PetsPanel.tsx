import {
  PetGenerateDialog,
  type PetGenerateSubmission,
  PetSettings,
  type PetSettingsOption,
  PetUploadDialog,
  type PetUploadSubmission,
} from "@ngriffin_uk/polychat-component-account";
import {
  DEFAULT_PET_PRESET_SLUG,
  PET_LIBRARY_LIMIT,
  PET_PRESETS,
  PET_SHEET_MAX_BYTES,
  findPetSheetLayout,
  resolvePetPreset,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useState } from "react";

import { PetPreview } from "~/components/Core/PetPreview";
import { useAuthStatus } from "~/hooks/useAuth";
import { usePets } from "~/hooks/usePets";
import { composePetSheet } from "~/lib/pet/compose-sheet";

const MAX_MEBIBYTES = Math.round(PET_SHEET_MAX_BYTES / 1024 / 1024);

const GENERATE_SUGGESTIONS = [
  "A cosy red panda in a knitted jumper",
  "A tiny space robot with one wobbly antenna",
  "A friendly cave bear holding a lantern",
] as const;

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PetsPanel() {
  const { user, userSettings, updateUserSettings } = useAuthStatus();
  const { pets, createPet, isCreatingPet, deletePet, generatePet, isGeneratingPet } = usePets();

  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const canAuthor = user?.plan_id === "pro";

  useEffect(() => {
    if (!isGenerateOpen) {
      setPreviewImage(null);
      setGenerateError(null);
    }
  }, [isGenerateOpen]);

  useEffect(() => {
    if (!isUploadOpen) {
      setUploadError(null);
    }
  }, [isUploadOpen]);

  const selectedId =
    userSettings?.pet_source === "custom"
      ? (userSettings.pet_id ?? "")
      : (userSettings?.pet_id ?? DEFAULT_PET_PRESET_SLUG);

  const options: PetSettingsOption[] = [
    ...PET_PRESETS.map((preset) => ({
      id: preset.slug,
      source: "preset" as const,
      name: preset.label,
      description: preset.description,
      canDelete: false,
    })),
    ...pets.map((pet) => ({
      id: pet.id,
      source: "custom" as const,
      name: pet.name,
      description: pet.description,
      canDelete: true,
      layout: findPetSheetLayout(pet.layout_id),
      sheetUrl: pet.sheet_url,
    })),
  ];

  const handleSelect = useCallback(
    async (option: PetSettingsOption) => {
      setError(null);

      try {
        await updateUserSettings({ pet_source: option.source, pet_id: option.id });
      } catch (selectError) {
        setError(messageFrom(selectError, "That pet could not be selected."));
      }
    },
    [updateUserSettings],
  );

  const handleTravelChange = useCallback(
    async (enabled: boolean) => {
      setError(null);

      try {
        await updateUserSettings({ pet_travel_enabled: enabled });
      } catch (travelError) {
        setError(messageFrom(travelError, "That setting could not be saved."));
      }
    },
    [updateUserSettings],
  );

  const handleAnimationChange = useCallback(
    async (enabled: boolean) => {
      setError(null);

      try {
        await updateUserSettings({ pet_animation_enabled: enabled });
      } catch (animationError) {
        setError(messageFrom(animationError, "That setting could not be saved."));
      }
    },
    [updateUserSettings],
  );

  const handleDelete = useCallback(
    async (option: PetSettingsOption) => {
      setError(null);

      try {
        await deletePet(option.id);
      } catch (deleteError) {
        setError(messageFrom(deleteError, "That pet could not be deleted."));
      }
    },
    [deletePet],
  );

  const handleUpload = useCallback(
    async (submission: PetUploadSubmission) => {
      setUploadError(null);

      try {
        await createPet({
          name: submission.name,
          description: submission.description || undefined,
          origin: "upload",
          sheet: submission.sheet,
          filename: submission.sheet.name,
        });
        setIsUploadOpen(false);
      } catch (submitError) {
        setUploadError(messageFrom(submitError, "The upload failed."));
      }
    },
    [createPet],
  );

  const handleGenerate = useCallback(
    async (prompt: string) => {
      setGenerateError(null);
      setPreviewImage(null);

      try {
        setPreviewImage(await generatePet({ prompt, name: prompt }));
      } catch (drawError) {
        setGenerateError(messageFrom(drawError, "The pet could not be drawn."));
      }
    },
    [generatePet],
  );

  const handleKeepGenerated = useCallback(
    async (submission: PetGenerateSubmission) => {
      if (!previewImage) {
        return;
      }

      setGenerateError(null);

      try {
        const sheet = await composePetSheet(previewImage);

        await createPet({
          name: submission.name,
          description: submission.description || undefined,
          prompt: submission.prompt,
          origin: "generated",
          sheet,
          filename: "pet.webp",
        });
        setIsGenerateOpen(false);
      } catch (saveError) {
        setGenerateError(messageFrom(saveError, "The pet could not be saved."));
      }
    },
    [createPet, previewImage],
  );

  return (
    <>
      <PetSettings
        options={options}
        selectedId={selectedId}
        travelEnabled={Boolean(userSettings?.pet_travel_enabled)}
        animationEnabled={Boolean(userSettings?.pet_animation_enabled)}
        canAuthor={canAuthor}
        limitReached={pets.length >= PET_LIBRARY_LIMIT}
        libraryLimit={PET_LIBRARY_LIMIT}
        isBusy={isCreatingPet || isGeneratingPet}
        error={error}
        onSelect={(option) => void handleSelect(option)}
        onTravelChange={(enabled) => void handleTravelChange(enabled)}
        onAnimationChange={(enabled) => void handleAnimationChange(enabled)}
        onDelete={(option) => void handleDelete(option)}
        onUpload={() => setIsUploadOpen(true)}
        onGenerate={() => setIsGenerateOpen(true)}
        renderPreview={(option) => {
          const url =
            option.source === "preset"
              ? resolvePetPreset(option.id).sheetUrl
              : (option.sheetUrl ?? "");

          return url ? (
            <PetPreview
              sheetUrl={url}
              label={option.name}
              layout={option.layout}
              size={64}
              paused={!userSettings?.pet_animation_enabled}
            />
          ) : null;
        }}
      />

      <PetUploadDialog
        open={isUploadOpen}
        isSaving={isCreatingPet}
        error={uploadError}
        maxMebibytes={MAX_MEBIBYTES}
        onOpenChange={setIsUploadOpen}
        onSubmit={(submission) => void handleUpload(submission)}
      />

      <PetGenerateDialog
        open={isGenerateOpen}
        isGenerating={isGeneratingPet}
        isSaving={isCreatingPet}
        hasPreview={previewImage !== null}
        error={generateError}
        suggestions={GENERATE_SUGGESTIONS}
        preview={
          previewImage ? (
            <img
              src={previewImage}
              alt="The pet Polychat drew"
              className="h-24 w-24 object-contain"
            />
          ) : null
        }
        onOpenChange={setIsGenerateOpen}
        onGenerate={(prompt) => void handleGenerate(prompt)}
        onSave={(submission) => void handleKeepGenerated(submission)}
      />
    </>
  );
}
