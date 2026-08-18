import { Button, Card, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { GitBranch, Pencil, Unplug } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface CodingRepositoryOption {
  key: string;
  repo: string;
  installationId: number;
}

export interface ProjectCodingEnvironment {
  installationId: number;
  repository: string;
  shouldCommit?: boolean;
}

export interface ProjectCodingEnvironmentCardProps {
  canManage: boolean;
  /** Rendered without its own card chrome when the parent already provides one. */
  embedded?: boolean;
  codingEnvironment: ProjectCodingEnvironment | null;
  repositoryOptions: CodingRepositoryOption[];
  isLoadingRepositories?: boolean;
  isSaving?: boolean;
  errorMessage?: string;
  onConnect: (input: {
    installationId: number;
    repository: string;
    shouldCommit: boolean;
  }) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function ProjectCodingEnvironmentCard({
  canManage,
  embedded = false,
  codingEnvironment,
  repositoryOptions,
  isLoadingRepositories = false,
  isSaving = false,
  errorMessage,
  onConnect,
  onDisconnect,
}: ProjectCodingEnvironmentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [repositoryKey, setRepositoryKey] = useState("");
  const [shouldCommit, setShouldCommit] = useState(true);

  const configuredKey = codingEnvironment
    ? `${codingEnvironment.installationId}:${codingEnvironment.repository.toLowerCase()}`
    : "";
  const selectedRepository = useMemo(
    () => repositoryOptions.find((option) => option.key === repositoryKey),
    [repositoryOptions, repositoryKey],
  );

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    setRepositoryKey(configuredKey);
    setShouldCommit(codingEnvironment?.shouldCommit ?? true);
  }, [codingEnvironment, configuredKey, isEditing]);

  const handleSave = async () => {
    if (!selectedRepository) {
      return;
    }

    await onConnect({
      installationId: selectedRepository.installationId,
      repository: selectedRepository.repo,
      shouldCommit,
    });
    setIsEditing(false);
  };

  const handleDisconnect = async () => {
    await onDisconnect();
    setIsEditing(false);
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <GitBranch size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Coding repository</h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              The repository used for project coding tasks.
            </p>
          </div>
        </div>
        {canManage && !isEditing && (
          <Button
            variant="icon"
            icon={<Pencil size={15} />}
            aria-label="Edit coding repository"
            title="Edit coding repository"
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <FormSelect
            label="GitHub repository"
            value={repositoryKey}
            onChange={(event) => setRepositoryKey(event.target.value)}
            disabled={isLoadingRepositories}
            options={[
              {
                value: "",
                label: isLoadingRepositories ? "Loading repositories…" : "Choose a repository",
              },
              ...repositoryOptions.map((option) => ({
                value: option.key,
                label: option.repo,
              })),
            ]}
          />
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={shouldCommit}
              onChange={(event) => setShouldCommit(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600"
            />
            Create a commit when changes are ready
          </label>
          {errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!selectedRepository}
              isLoading={isSaving}
            >
              Save repository
            </Button>
          </div>
        </div>
      ) : codingEnvironment ? (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {codingEnvironment.repository}
            </p>
          </div>
          {canManage && (
            <Button variant="outline" icon={<Unplug size={15} />} onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">No repository connected.</p>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="whitespace-nowrap"
              onClick={() => setIsEditing(true)}
            >
              Connect repository
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return embedded ? (
    <section className="border-t border-zinc-100 p-5 dark:border-zinc-800">{content}</section>
  ) : (
    <Card className="p-5 shadow-none">{content}</Card>
  );
}
