import {
  PetGenerateDialog,
  type PetGenerateSubmission,
  PetImportDialog,
  PetSettings,
  type PetSettingsOption,
  PetUploadDialog,
  type PetUploadSubmission,
} from "@ngriffin_uk/polychat-component-account";
import { PetPreview } from "@ngriffin_uk/polychat-component-ui";
import {
  useAuthStatus,
  useCursorPages,
  useModels,
  usePet,
  usePets,
  composePetSheet,
  getPetModelTargetOptions,
} from "@ngriffin_uk/polychat-library-react";
import {
  DEFAULT_PET_PRESET_SLUG,
  EMPTY_PET_MODEL_OVERRIDES,
  PET_PRESETS,
  PET_SHEET_MAX_BYTES,
  POLYCHAT_SHEET_LAYOUT_ID,
  findPetSheetLayout,
  parsePetModelOverrides,
  resolvePetPreset,
  type GeneratedPetImage,
  type PetModelOverrides,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useMemo, useState } from "react";

import { usePetPackages } from "./usePetPackages.js";

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
  const petPages = useCursorPages();
  const {
    pets,
    nextPetsCursor,
    createPet,
    isCreatingPet,
    deletePet,
    isDeletingPet,
    generatePet,
    isGeneratingPet,
    generatePetPoses,
    isGeneratingPoses,
    importPet,
    isImportingPet,
  } = usePets(petPages.cursor);
  const packages = usePetPackages(importPet);
  const { data: models = {} } = useModels();

  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<GeneratedPetImage | null>(null);

  const canAuthor = user?.plan_id === "pro";
  const modelTargets = useMemo(() => getPetModelTargetOptions(models), [models]);
  const modelOverrides = parsePetModelOverrides(
    userSettings?.pet_model_overrides ?? EMPTY_PET_MODEL_OVERRIDES,
  );

  if (!isGenerateOpen && (previewImage !== null || generateError !== null)) {
    setPreviewImage(null);
    setGenerateError(null);
  }

  if (!isUploadOpen && uploadError !== null) {
    setUploadError(null);
  }

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
        if (pets.length === 1) {
          petPages.previous();
        }
      } catch (deleteError) {
        setError(messageFrom(deleteError, "That pet could not be deleted."));
      }
    },
    [deletePet, petPages, pets.length],
  );

  const handleUpload = useCallback(
    async (submission: PetUploadSubmission) => {
      setUploadError(null);

      try {
        await createPet({
          name: submission.name,
          description: submission.description || undefined,
          origin: "upload",
          layoutId: submission.layoutId,
          sheet: submission.sheet,
          filename: submission.sheet.name,
        });
        petPages.reset();
        setIsUploadOpen(false);
      } catch (submitError) {
        setUploadError(messageFrom(submitError, "The upload failed."));
      }
    },
    [createPet, petPages],
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
        const { poses } = await generatePetPoses({
          prompt: submission.prompt,
          seed: previewImage.seed,
        });
        const sheet = await composePetSheet(previewImage.image, { poses });

        await createPet({
          name: submission.name,
          description: submission.description || undefined,
          prompt: submission.prompt,
          origin: "generated",
          layoutId: POLYCHAT_SHEET_LAYOUT_ID,
          sheet,
          filename: "pet.webp",
        });
        petPages.reset();
        setIsGenerateOpen(false);
      } catch (saveError) {
        setGenerateError(messageFrom(saveError, "The pet could not be saved."));
      }
    },
    [createPet, generatePetPoses, petPages, previewImage],
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
        customPetPage={petPages.page}
        hasPreviousCustomPets={petPages.hasPrevious}
        hasNextCustomPets={Boolean(nextPetsCursor)}
        isBusy={isCreatingPet || isDeletingPet || isGeneratingPet || isUpdatingUserSettings}
        error={error ?? packages.exportError}
        onSelect={(option) => void handleSelect(option)}
        onTravelChange={(enabled) => void handleTravelChange(enabled)}
        onAnimationChange={(enabled) => void handleAnimationChange(enabled)}
        onModelOverridesChange={(overrides) => void handleModelOverridesChange(overrides)}
        onPreviousCustomPets={petPages.previous}
        onNextCustomPets={() => petPages.next(nextPetsCursor)}
        onDelete={(option) => void handleDelete(option)}
        onExport={(option) => {
          const pet = visibleCustomPets.find((entry) => entry.id === option.id);

          if (pet) {
            void packages.exportPet(pet);
          }
        }}
        onImport={() => packages.openImport(true)}
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

      <PetImportDialog
        open={packages.isImportOpen}
        isImporting={isImportingPet}
        error={packages.importError}
        onOpenChange={packages.openImport}
        onSubmit={(url) => void packages.submitImport(url, petPages.reset)}
      />

      <PetGenerateDialog
        open={isGenerateOpen}
        isGenerating={isGeneratingPet}
        isSaving={isCreatingPet || isGeneratingPoses}
        hasPreview={previewImage !== null}
        error={generateError}
        suggestions={GENERATE_SUGGESTIONS}
        preview={
          previewImage ? (
            <img
              src={previewImage.image}
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
