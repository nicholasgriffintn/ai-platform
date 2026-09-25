import { LibraryList, SourceResultsList } from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import {
  useModelLibrary,
  useModelRegistryMutations,
  useModelSourceSearch,
} from "@ngriffin_uk/polychat-library-react";
import type { ModelAssetKind, SourceSearchResult } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useDebouncedValue } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { modelVersionPath } from "./modelPaths.js";
import { ModelsSection } from "./ModelsSection.js";

type LibraryMode = "library" | "sources";

export function LibraryTab({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LibraryMode>("library");
  const [kind, setKind] = useState<ModelAssetKind>("model");
  const [search, setSearch] = useState("");
  const [importingRef, setImportingRef] = useState<string | null>(null);
  const library = useModelLibrary(workspaceId, projectId);
  const debouncedSearch = useDebouncedValue(search, 350);
  const sources = useModelSourceSearch(
    workspaceId,
    mode === "sources" ? debouncedSearch : "",
    kind,
    projectId,
  );
  const mutations = useModelRegistryMutations(workspaceId);
  const entries = (library.data ?? []).filter((entry) => entry.asset.kind === kind);
  const openVersion = (versionId: string) =>
    void navigate(modelVersionPath(workspaceId, versionId, projectId));

  const importResult = async (result: SourceSearchResult) => {
    setImportingRef(result.sourceRef);

    try {
      const detail = await mutations.importAsset.mutateAsync({
        source: "huggingface",
        kind: result.kind,
        sourceRef: result.sourceRef,
      });

      toast.success("Pinned and queued for inspection");
      openVersion(detail.version.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Import failed"));
    } finally {
      setImportingRef(null);
    }
  };

  const segmented = (
    <div className="flex flex-wrap gap-2">
      <div className="inline-flex rounded-md border border-border p-0.5">
        {(["library", "sources"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={mode === value ? "secondary" : "ghost"}
            onClick={() => setMode(value)}
          >
            {value === "library" ? "Imported" : "Hugging Face"}
          </Button>
        ))}
      </div>
      <div className="inline-flex rounded-md border border-border p-0.5">
        {(["model", "dataset"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={kind === value ? "secondary" : "ghost"}
            onClick={() => setKind(value)}
          >
            {value === "model" ? "Models" : "Datasets"}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <ModelsSection
      title={
        mode === "library"
          ? projectId
            ? "In this project"
            : "In this workspace"
          : "Find on Hugging Face"
      }
      description={
        mode === "library"
          ? "Every version is pinned to a commit. Open one to see its evidence and decisions."
          : "Chips come from metadata alone. Nothing is downloaded until you import, and an import pins the exact commit for review."
      }
      actions={segmented}
    >
      {mode === "library" ? (
        library.isLoading ? (
          <CardSkeleton />
        ) : (
          <LibraryList entries={entries} onOpen={(entry) => openVersion(entry.version.id)} />
        )
      ) : (
        <div className="space-y-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              kind === "model" ? "Search Hugging Face models" : "Search Hugging Face datasets"
            }
          />
          {search.trim().length < 2 ? null : sources.isLoading ? (
            <CardSkeleton />
          ) : sources.error ? (
            <p className="text-sm text-failure">
              {getErrorMessage(sources.error, "Search failed")}
            </p>
          ) : (
            <SourceResultsList
              results={sources.data ?? []}
              importingRef={importingRef}
              onImport={(result) => void importResult(result)}
              onOpen={openVersion}
            />
          )}
        </div>
      )}
    </ModelsSection>
  );
}
