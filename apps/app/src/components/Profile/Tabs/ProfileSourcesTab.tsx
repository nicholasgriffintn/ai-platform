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
} from "@ngriffin_uk/polychat-component-ui";
import type { SourceKind } from "@ngriffin_uk/polychat-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import { API_BASE_URL } from "~/constants";
import { useSourceCollections, useSourceMutations, useSources } from "~/hooks/useSources";

import { MemorySynthesisPanel } from "../MemorySynthesisPanel";

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
  title?: string;
}

export function SourcesLibrary({ projectId, title = "Sources" }: SourcesLibraryProps) {
  const [kind, setKind] = useState<"" | SourceKind>("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [isCreateSourceOpen, setIsCreateSourceOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [sourceIdToDelete, setSourceIdToDelete] = useState<string | null>(null);
  const [collectionIdToDelete, setCollectionIdToDelete] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("");
  const {
    data: sources,
    isLoading,
    error,
  } = useSources({
    projectId,
    kind: collectionId ? undefined : kind || undefined,
    collectionId,
  });
  const { data: sourceCollections } = useSourceCollections(projectId);
  const collections = sourceCollections?.filter((collection) => collection.kind !== "context");
  const mutations = useSourceMutations();
  const selectedCollection = collections?.find((collection) => collection.id === collectionId);

  return (
    <ProfileTab
      title={title}
      actions={
        projectId
          ? []
          : [
              {
                label: "Add source",
                icon: <Plus size={16} />,
                onClick: () => setIsCreateSourceOpen(true),
              },
            ]
      }
      description={
        projectId
          ? "Memories and sources available to this project."
          : "Files, memories, links, repositories, and connected records available to Polychat."
      }
    >
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
              collectionId ? null : (
                <SourceKindFilter
                  kindOptions={sourceKinds}
                  kind={kind}
                  onKindChange={(value) => setKind(value as "" | SourceKind)}
                />
              )
            }
          >
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

      {!projectId ? (
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
      ) : null}

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
    </ProfileTab>
  );
}

export function ProfileSourcesTab() {
  return <SourcesLibrary />;
}
