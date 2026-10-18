import { fetchUserPetSheet } from "@ngriffin_uk/polychat-library-client";
import { buildPetManifest, type UserPet } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { downloadBlob, downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { useCallback, useState } from "react";

export function usePetPackages(importPet: (url: string) => Promise<UserPet>) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const openImport = useCallback((open: boolean) => {
    setIsImportOpen(open);

    if (!open) {
      setImportError(null);
    }
  }, []);

  const submitImport = useCallback(
    async (url: string, onImported: () => void) => {
      setImportError(null);

      try {
        await importPet(url);
        onImported();
        setIsImportOpen(false);
      } catch (error) {
        setImportError(getErrorMessage(error, "That pet could not be imported."));
      }
    },
    [importPet],
  );

  const exportPet = useCallback(
    async (pet: Pick<UserPet, "id" | "name" | "description" | "layout_id">) => {
      setExportError(null);

      try {
        const manifest = buildPetManifest({
          id: pet.id,
          name: pet.name,
          description: pet.description,
          layoutId: pet.layout_id,
        });
        const sheet = await fetchUserPetSheet(pet.id);

        downloadTextFile("pet.json", `${JSON.stringify(manifest, null, 2)}\n`, "application/json");
        downloadBlob(manifest.spritesheetPath ?? "spritesheet.webp", sheet);
      } catch (error) {
        setExportError(getErrorMessage(error, "That pet could not be downloaded."));
      }
    },
    [],
  );

  return {
    isImportOpen,
    importError,
    exportError,
    openImport,
    submitImport,
    exportPet,
  };
}
