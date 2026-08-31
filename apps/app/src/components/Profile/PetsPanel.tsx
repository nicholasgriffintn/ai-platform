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
  EMPTY_PET_MODEL_OVERRIDES,
  PET_PRESETS,
  PET_SHEET_MAX_BYTES,
  findPetSheetLayout,
  parsePetModelOverrides,
  resolvePetPreset,
  type PetModelOverrides,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PetPreview } from "~/components/Core/PetPreview";
import { useAuthStatus } from "~/hooks/useAuth";
import { useModels } from "~/hooks/useModels";
import { usePet, usePets } from "~/hooks/usePets";
import { composePetSheet } from "~/lib/pet/compose-sheet";
import { getPetModelTargetOptions } from "~/lib/pet/model-targets";

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
  const { user, userSettings, updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const [petPage, setPetPage] = useState(1);
  const {
    pets,
    hasMorePets,
    createPet,
    isCreatingPet,
    deletePet,
    isDeletingPet,
    generatePet,
    isGeneratingPet,
  } = usePets(petPage);
  const { data: models = {} } = useModels();

  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const canAuthor = user?.plan_id === "pro";
  const modelTargets = useMemo(() => getPetModelTargetOptions(models), [models]);
  const modelOverrides = parsePetModelOverrides(
    userSettings?.pet_model_overrides ?? EMPTY_PET_MODEL_OVERRIDES,
  );

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
  const selectedCustomPetId = userSettings?.pet_source === "custom" ? selectedId : undefined;
  const selectedPetIsOnPage = pets.some((pet) => pet.id === selectedCustomPetId);
  const { data: selectedCustomPet } = usePet(
    selectedCustomPetId,
    Boolean(selectedCustomPetId) && !selectedPetIsOnPage,
  );
  const visibleCustomPets =
    selectedCustomPet && !selectedPetIsOnPage ? [...pets, selectedCustomPet] : pets;

  const options: PetSettingsOption[] = [
    ...PET_PRESETS.map((preset) => ({
      id: preset.slug,
      source: "preset" as const,
      name: preset.label,
      description: preset.description,
      canDelete: false,
    })),
    ...visibleCustomPets.map((pet) => ({
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

  const handleModelOverridesChange = useCallback(
    async (overrides: PetModelOverrides) => {
      setError(null);

      try {
        await updateUserSettings({ pet_model_overrides: overrides });
      } catch (overrideError) {
        setError(messageFrom(overrideError, "Those model pet settings could not be saved."));
      }
    },
    [updateUserSettings],
  );

  const handleDelete = useCallback(
    async (option: PetSettingsOption) => {
      setError(null);

      try {
        await deletePet(option.id);
        if (pets.length === 1 && petPage > 1) {
          setPetPage((page) => page - 1);
        }
      } catch (deleteError) {
        setError(messageFrom(deleteError, "That pet could not be deleted."));
      }
    },
    [deletePet, petPage, pets.length],
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
        setPetPage(1);
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
        setPetPage(1);
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
        modelTargets={modelTargets}
        modelOverrides={modelOverrides}
        customPetPage={petPage}
        hasPreviousCustomPets={petPage > 1}
        hasNextCustomPets={hasMorePets}
        isBusy={isCreatingPet || isDeletingPet || isGeneratingPet || isUpdatingUserSettings}
        error={error}
        onSelect={(option) => void handleSelect(option)}
        onTravelChange={(enabled) => void handleTravelChange(enabled)}
        onAnimationChange={(enabled) => void handleAnimationChange(enabled)}
        onModelOverridesChange={(overrides) => void handleModelOverridesChange(overrides)}
        onPreviousCustomPets={() => setPetPage((page) => Math.max(1, page - 1))}
        onNextCustomPets={() => setPetPage((page) => page + 1)}
        onDelete={(option) => void handleDelete(option)}
        onUpload={() => setIsUploadOpen(true)}
        onGenerate={() => setIsGenerateOpen(true)}
        renderPreview={(option, size = 64) => {
          const url =
            option.source === "preset"
              ? resolvePetPreset(option.id).sheetUrl
              : (option.sheetUrl ?? "");

          return url ? (
            <PetPreview
              sheetUrl={url}
              label={option.name}
              layout={option.layout}
              size={size}
              paused={!userSettings?.pet_animation_enabled}
              deferLoading={option.source === "custom"}
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
