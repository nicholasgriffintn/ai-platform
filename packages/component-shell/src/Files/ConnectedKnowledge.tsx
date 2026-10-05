import {
  KnowledgeConnectionForm,
  KnowledgeConnectionList,
  SettingsSection,
} from "@ngriffin_uk/polychat-component-account";
import {
  Button,
  ConfirmationDialog,
  FormInput,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useKnowledgeConnections,
  useKnowledgeSearch,
  useSandboxConnections,
  useSandboxRepositoryOptions,
  useAuthStatus,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { toast } from "sonner";

export function ConnectedKnowledge({ projectId }: { projectId?: string }) {
  const { user } = useAuthStatus();
  const connections = useSandboxConnections();
  const repositories = useSandboxRepositoryOptions(connections.data ?? []);
  const knowledge = useKnowledgeConnections(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const results = useKnowledgeSearch(projectId, search);

  return (
    <SettingsSection
      title="Connected knowledge"
      description="Search current repository documents. Private imports remain personal; project imports require public repositories. Imports refresh every 15 minutes."
      actions={
        <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
          Connect repository
        </Button>
      }
    >
      {knowledge.query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {knowledge.query.error.message}
        </p>
      ) : null}
      <KnowledgeConnectionList
        syncs={knowledge.query.data ?? []}
        userId={user?.id}
        isPending={knowledge.control.isPending || knowledge.remove.isPending}
        onControl={(id, input) =>
          knowledge.control.mutate(
            { id, ...input },
            {
              onError: (failure) => toast.error(failure.message),
            },
          )
        }
        onDisconnect={setDisconnectId}
      />
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <FormInput
          label="Search connected documents"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          maxLength={200}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={searchInput.trim().length < 2 || results.isFetching}
        >
          Search
        </Button>
      </form>
      {results.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {results.error.message}
        </p>
      ) : null}
      {search && !results.isFetching && results.data?.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No current documents match. Check your repository connection if access has changed.
        </p>
      ) : null}
      {results.data?.map((result) => (
        <article key={result.sourceId} className="mt-3 rounded-lg border border-border p-4">
          <a
            href={result.citation}
            target="_blank"
            rel="noreferrer"
            className={textLinkClassName()}
          >
            {result.title}
          </a>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{result.excerpt}</p>
        </article>
      ))}
      <KnowledgeConnectionForm
        open={showCreate}
        onOpenChange={setShowCreate}
        projectId={projectId}
        repositories={repositories.repoOptions}
        isPending={knowledge.create.isPending}
        onCreate={async (input) => {
          await knowledge.create.mutateAsync(input);
        }}
      />
      <ConfirmationDialog
        open={disconnectId !== null}
        onOpenChange={(open) => !open && setDisconnectId(null)}
        title="Disconnect knowledge"
        description="Delete imported documents and stop their sync? Your GitHub files remain available."
        confirmText="Disconnect"
        variant="destructive"
        isLoading={knowledge.remove.isPending}
        onConfirm={async () => {
          if (disconnectId) {
            await knowledge.remove.mutateAsync(disconnectId);
          }

          setDisconnectId(null);
        }}
      />
    </SettingsSection>
  );
}
