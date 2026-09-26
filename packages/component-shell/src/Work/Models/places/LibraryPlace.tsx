import { LibraryList, SourceResultsList } from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import {
  useModelLibrary,
  useModelPlatformMutations,
  useModelSourceSearch,
} from "@ngriffin_uk/polychat-library-react";
import type { SourceSearchResult } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useDebouncedValue } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { BucketImportDialog } from "../flows/BucketImportDialog.js";
import { UploadWeightsDialog } from "../flows/UploadWeightsDialog.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

type LibraryMode = "library" | "sources";
type LibraryKind = "model" | "adapter";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? "secondary" : "ghost"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function LibraryPlace() {
  const { workspaceId, projectId, open, can } = useModelsScope();
  const [mode, setMode] = useState<LibraryMode>("library");
  const [kind, setKind] = useState<LibraryKind>("model");
  const [search, setSearch] = useState("");
  const [importingRef, setImportingRef] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"upload" | "bucket" | null>(null);
  const library = useModelLibrary(workspaceId, kind, projectId);
  const debouncedSearch = useDebouncedValue(search, 350);
  const sources = useModelSourceSearch(
    workspaceId,
    mode === "sources" ? debouncedSearch : "",
    "model",
    projectId,
  );
  const mutations = useModelPlatformMutations(workspaceId);

  const importResult = async (result: SourceSearchResult) => {
    setImportingRef(result.sourceRef);

    const detail = await runWithToast("Pinned and queued for inspection", () =>
      mutations.importAsset.mutateAsync({
        source: "huggingface",
        kind: result.kind,
        sourceRef: result.sourceRef,
      }),
    );

    setImportingRef(null);

    if (detail) {
      open("versions", detail.version.id);
    }
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "library", label: "In this scope" },
          { value: "sources", label: "Hugging Face" },
        ]}
      />
      {mode === "library" && (
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "model", label: "Models" },
            { value: "adapter", label: "Adapters" },
          ]}
        />
      )}
      {can("upload") && (
        <Button size="sm" variant="secondary" onClick={() => setDialog("upload")}>
          Upload weights
        </Button>
      )}
      {can("import") && (
        <Button size="sm" variant="secondary" onClick={() => setDialog("bucket")}>
          From a bucket
        </Button>
      )}
    </div>
  );

  return (
    <>
      <ModelsSection
        title={mode === "library" ? "Models and adapters" : "Find on Hugging Face"}
        description={
          mode === "library"
            ? "Every version is pinned to a commit or content hash. Open one to see its evidence, lineage and routes."
            : "Chips come from metadata alone. Nothing is downloaded until you import, and an import pins the exact commit."
        }
        actions={actions}
      >
        {mode === "library" ? (
          library.isLoading ? (
            <CardSkeleton />
          ) : (
            <LibraryList
              entries={library.data ?? []}
              onOpen={(entry) => open("versions", entry.version.id)}
            />
          )
        ) : (
          <div className="space-y-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search Hugging Face models"
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
                onOpen={(versionId) => open("versions", versionId)}
              />
            )}
          </div>
        )}
      </ModelsSection>
      <UploadWeightsDialog
        open={dialog === "upload"}
        onOpenChange={(value) => setDialog(value ? "upload" : null)}
      />
      <BucketImportDialog
        open={dialog === "bucket"}
        onOpenChange={(value) => setDialog(value ? "bucket" : null)}
      />
    </>
  );
}
