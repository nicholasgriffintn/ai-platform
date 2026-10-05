import {
  SourceCollectionList,
  SourceList,
  SettingsSection,
  SourceKindFilter,
} from "@ngriffin_uk/polychat-component-account";
import {
  ConfirmationDialog,
  FormDialog,
  FormInput,
  Textarea,
  Button,
} from "@ngriffin_uk/polychat-component-ui";
import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { sourceKindSchema, type SourceKind } from "@ngriffin_uk/polychat-schemas";
import { toast } from "sonner";

import { KnowledgeSyncPanel } from "./KnowledgeSyncPanel.js";
import { MemorySynthesisPanel } from "./MemorySynthesisPanel.js";
import { ProjectKnowledgeSearch } from "./ProjectKnowledgeSearch.js";
import { useSourcesLibrary } from "./useSourcesLibrary.js";

const sourceKinds: Array<{ value: "" | SourceKind; label: string }> = [
  { value: "", label: "All sources" },
  { value: "file", label: "Files" },
  { value: "memory", label: "Memories" },
  { value: "text", label: "Text" },
  { value: "url", label: "URLs" },
  { value: "connector", label: "Connected records" },
  { value: "repository", label: "Repositories" },
];

interface SourcesLibraryProps {
  projectId?: string;
  createRequestKey?: number;
}

export function SourcesLibrary({ projectId, createRequestKey }: SourcesLibraryProps) {
  const {
    kind,
    setKind,
    collectionId,
    setCollectionId,
    isCreateSourceOpen,
    setIsCreateSourceOpen,
    isCreateCollectionOpen,
    setIsCreateCollectionOpen,
    sourceIdToDelete,
    setSourceIdToDelete,
    collectionIdToDelete,
    setCollectionIdToDelete,
    sourceTitle,
    setSourceTitle,
    sourceContent,
    setSourceContent,
    collectionTitle,
    setCollectionTitle,
    sources,
    isLoading,
    error,
    collections,
    mutations,
    selectedCollection,
  } = useSourcesLibrary(projectId, createRequestKey);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <SourceCollectionList
            collections={collections}
            selectedCollectionId={collectionId}
            onSelectCollection={setCollectionId}
            onCreateCollection={() => setIsCreateCollectionOpen(true)}
            onDeleteCollection={setCollectionIdToDelete}
          />
        </aside>

        <section className="min-w-0">
          <SettingsSection
            title={selectedCollection?.title ?? "All sources"}
            description={
              selectedCollection
                ? "Sources grouped in this collection."
                : "Browse and manage available source material."
            }
            actions={
              <div className="flex items-center gap-2">
                {projectId ? (
                  <Button variant="secondary" onClick={() => setIsCreateSourceOpen(true)}>
                    Add source
                  </Button>
                ) : null}
                {collectionId ? null : (
                  <SourceKindFilter
                    kindOptions={sourceKinds}
                    kind={kind}
                    onKindChange={(value) => setKind(sourceKindSchema.safeParse(value).data ?? "")}
                  />
                )}
              </div>
            }
          >
            <ProjectKnowledgeSearch key={projectId ?? "personal"} projectId={projectId} />
            {projectId ? <KnowledgeSyncPanel projectId={projectId} /> : null}
            <SourceList
              sources={sources}
              collections={collections}
              isLoading={isLoading}
              errorMessage={error?.message}
              isCollectionView={!!selectedCollection}
              fileHref={(source) => `${API_BASE_URL}/sources/${source.id}/content`}
              onAddToCollection={
                collectionId
                  ? undefined
                  : (targetCollectionId, sourceId) =>
                      mutations.addToCollection.mutate({
                        collectionId: targetCollectionId,
                        sourceId,
                      })
              }
              onDelete={setSourceIdToDelete}
            />
          </SettingsSection>

          {!projectId ? (
            <div className="mt-6">
              <MemorySynthesisPanel />
            </div>
          ) : null}
        </section>
      </div>

      <FormDialog
        open={isCreateSourceOpen}
        onOpenChange={setIsCreateSourceOpen}
        title="Add source"
        description="Add text that Polychat can use as source material."
        submitText="Add source"
        isLoading={mutations.createSource.isPending}
        submitDisabled={!sourceTitle.trim() || !sourceContent.trim()}
        onSubmit={async () => {
          await mutations.createSource.mutateAsync({
            projectId,
            kind: "text",
            title: sourceTitle.trim(),
            content: sourceContent.trim(),
            status: "available",
            metadata: {},
          });
          setSourceTitle("");
          setSourceContent("");
          setIsCreateSourceOpen(false);
          toast.success("Source added");
        }}
      >
        <FormInput
          label="Title"
          value={sourceTitle}
          onChange={(event) => setSourceTitle(event.target.value)}
          required
        />
        <div className="space-y-1">
          <label htmlFor="source-content" className="text-sm font-medium">
            Content
          </label>
          <Textarea
            id="source-content"
            value={sourceContent}
            onChange={(event) => setSourceContent(event.target.value)}
            className="min-h-32"
            required
          />
        </div>
      </FormDialog>

      <FormDialog
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
        title="Create collection"
        description="Group related sources so they can be found together."
        submitText="Create collection"
        isLoading={mutations.createCollection.isPending}
        submitDisabled={!collectionTitle.trim()}
        onSubmit={async () => {
          await mutations.createCollection.mutateAsync({
            projectId,
            title: collectionTitle.trim(),
            kind: "general",
          });
          setCollectionTitle("");
          setIsCreateCollectionOpen(false);
          toast.success("Collection created");
        }}
      >
        <FormInput
          label="Name"
          value={collectionTitle}
          onChange={(event) => setCollectionTitle(event.target.value)}
          required
        />
      </FormDialog>

      <ConfirmationDialog
        open={sourceIdToDelete !== null}
        onOpenChange={(open) => !open && setSourceIdToDelete(null)}
        title="Delete source"
        description="Delete this source from Polychat? This cannot be undone."
        confirmText="Delete source"
        variant="destructive"
        isLoading={mutations.deleteSource.isPending}
        onConfirm={async () => {
          if (sourceIdToDelete) {
            await mutations.deleteSource.mutateAsync(sourceIdToDelete);
          }

          setSourceIdToDelete(null);
        }}
      />
      <ConfirmationDialog
        open={collectionIdToDelete !== null}
        onOpenChange={(open) => !open && setCollectionIdToDelete(null)}
        title="Delete collection"
        description="Delete this collection? Its sources will remain available."
        confirmText="Delete collection"
        variant="destructive"
        isLoading={mutations.deleteCollection.isPending}
        onConfirm={async () => {
          if (collectionIdToDelete) {
            await mutations.deleteCollection.mutateAsync(collectionIdToDelete);
            if (collectionId === collectionIdToDelete) {
              setCollectionId(null);
            }
          }

          setCollectionIdToDelete(null);
        }}
      />
    </>
  );
}
