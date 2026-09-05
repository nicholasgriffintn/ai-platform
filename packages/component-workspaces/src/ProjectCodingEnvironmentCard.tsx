import { Button, Card, FormInput, FormSelect, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  DEFAULT_SANDBOX_DELIVERY_POLICY,
  sandboxEnvironmentSetupSchema,
  type SandboxDeliveryPolicy,
  type SandboxEnvironmentCacheSummary,
  type SandboxEnvironmentSetup,
} from "@ngriffin_uk/polychat-schemas";
import { formatBytes, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Database, GitBranch, Pencil, RotateCcw, Trash2, Unplug } from "lucide-react";
import { useMemo, useState } from "react";

import { ProjectEnvironmentSetupFields } from "./ProjectEnvironmentSetupFields";

export interface CodingRepositoryOption {
  key: string;
  repo: string;
  installationId: number;
}

export interface ProjectCodingEnvironment {
  installationId: number;
  repository: string;
  deliveryPolicy: SandboxDeliveryPolicy;
  environmentSetup?: SandboxEnvironmentSetup;
}

export interface ProjectCodingEnvironmentCardProps {
  canManage: boolean;
  embedded?: boolean;
  codingEnvironment: ProjectCodingEnvironment | null;
  environmentCache?: SandboxEnvironmentCacheSummary | null;
  repositoryOptions: CodingRepositoryOption[];
  isLoadingRepositories?: boolean;
  isSaving?: boolean;
  errorMessage?: string;
  cacheMessage?: string;
  isUpdatingCache?: boolean;
  onConnect: (input: {
    installationId: number;
    repository: string;
    deliveryPolicy: SandboxDeliveryPolicy;
    environmentSetup?: SandboxEnvironmentSetup;
  }) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRebuildCache: () => Promise<void>;
  onDeleteCache: () => Promise<void>;
}

export function ProjectCodingEnvironmentCard({
  canManage,
  embedded = false,
  codingEnvironment,
  environmentCache,
  repositoryOptions,
  isLoadingRepositories = false,
  isSaving = false,
  errorMessage,
  cacheMessage,
  isUpdatingCache = false,
  onConnect,
  onDisconnect,
  onRebuildCache,
  onDeleteCache,
}: ProjectCodingEnvironmentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [repositoryKey, setRepositoryKey] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<string>(DEFAULT_SANDBOX_DELIVERY_POLICY.mode);
  const [reviewDestination, setReviewDestination] = useState<string>(
    DEFAULT_SANDBOX_DELIVERY_POLICY.destination,
  );
  const [targetBranch, setTargetBranch] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [environmentSetup, setEnvironmentSetup] = useState<SandboxEnvironmentSetup | undefined>();

  const configuredKey = codingEnvironment
    ? `${codingEnvironment.installationId}:${codingEnvironment.repository.toLowerCase()}`
    : "";
  const selectedRepository = useMemo(
    () => repositoryOptions.find((option) => option.key === repositoryKey),
    [repositoryOptions, repositoryKey],
  );

  const beginEditing = () => {
    setRepositoryKey(configuredKey);
    const policy = codingEnvironment?.deliveryPolicy ?? DEFAULT_SANDBOX_DELIVERY_POLICY;

    setDeliveryMode(policy.mode);
    setReviewDestination(
      policy.mode === "review_branch"
        ? policy.destination
        : DEFAULT_SANDBOX_DELIVERY_POLICY.destination,
    );
    setTargetBranch(policy.mode === "commit_to_branch" ? policy.targetBranch : "");
    setCustomInstructions(policy.mode === "custom" ? policy.instructions : "");
    setEnvironmentSetup(codingEnvironment?.environmentSetup);
    setIsEditing(true);
  };

  const selectedDeliveryPolicy = useMemo<SandboxDeliveryPolicy | null>(() => {
    if (deliveryMode === "leave_uncommitted") {
      return { mode: "leave_uncommitted" };
    }

    if (deliveryMode === "review_branch") {
      return {
        mode: "review_branch",
        destination: reviewDestination === "branch" ? "branch" : "pull_request",
      };
    }

    if (deliveryMode === "commit_to_branch" && targetBranch.trim()) {
      return { mode: "commit_to_branch", targetBranch: targetBranch.trim() };
    }

    if (deliveryMode === "custom" && customInstructions.trim()) {
      return { mode: "custom", instructions: customInstructions.trim() };
    }

    return null;
  }, [customInstructions, deliveryMode, reviewDestination, targetBranch]);
  const hasValidEnvironmentSetup =
    environmentSetup === undefined ||
    sandboxEnvironmentSetupSchema.safeParse(environmentSetup).success;

  const handleSave = async () => {
    if (!selectedRepository || !selectedDeliveryPolicy) {
      return;
    }

    await onConnect({
      installationId: selectedRepository.installationId,
      repository: selectedRepository.repo,
      deliveryPolicy: selectedDeliveryPolicy,
      environmentSetup,
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
          <div className="rounded-lg bg-success/12 p-2 text-success">
            <GitBranch size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Coding repository</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
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
            onClick={beginEditing}
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
          <FormSelect
            label="Delivery policy"
            value={deliveryMode}
            onChange={(event) => setDeliveryMode(event.target.value)}
            options={[
              { value: "leave_uncommitted", label: "Leave changes uncommitted" },
              { value: "review_branch", label: "Prepare a branch or pull request" },
              { value: "commit_to_branch", label: "Commit to a configured branch" },
              { value: "custom", label: "Custom delivery instructions" },
            ]}
          />
          {deliveryMode === "review_branch" ? (
            <FormSelect
              label="Review destination"
              value={reviewDestination}
              onChange={(event) => setReviewDestination(event.target.value)}
              options={[
                { value: "pull_request", label: "Open a pull request (recommended)" },
                { value: "branch", label: "Push a review branch" },
              ]}
            />
          ) : null}
          {deliveryMode === "commit_to_branch" ? (
            <FormInput
              label="Target branch"
              value={targetBranch}
              onChange={(event) => setTargetBranch(event.target.value)}
              placeholder="release/next"
              maxLength={200}
            />
          ) : null}
          {deliveryMode === "custom" ? (
            <label
              htmlFor="project-coding-delivery-instructions"
              className="block space-y-1.5 text-sm text-foreground"
            >
              <span className="font-medium">Delivery instructions</span>
              <Textarea
                id="project-coding-delivery-instructions"
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
                placeholder="Describe how the local result should be prepared"
                maxLength={2000}
                rows={4}
              />
            </label>
          ) : null}
          <ProjectEnvironmentSetupFields value={environmentSetup} onChange={setEnvironmentSetup} />
          <p className="text-xs text-muted-foreground">
            Remote GitHub writes wait for the runner’s approval after validation. Custom
            instructions never grant remote-write authority.
          </p>
          {errorMessage && (
            <p role="alert" className="text-sm text-failure">
              {errorMessage}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!selectedRepository || !selectedDeliveryPolicy || !hasValidEnvironmentSetup}
              isLoading={isSaving}
            >
              Save repository
            </Button>
          </div>
        </div>
      ) : codingEnvironment ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-medium text-foreground">
                {codingEnvironment.repository}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {codingEnvironment.deliveryPolicy.mode === "leave_uncommitted"
                  ? "Leave changes uncommitted"
                  : codingEnvironment.deliveryPolicy.mode === "review_branch"
                    ? codingEnvironment.deliveryPolicy.destination === "pull_request"
                      ? "Prepare a pull request after approval"
                      : "Prepare a review branch after approval"
                    : codingEnvironment.deliveryPolicy.mode === "commit_to_branch"
                      ? `Commit to ${codingEnvironment.deliveryPolicy.targetBranch} after approval`
                      : "Use custom local delivery instructions"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {codingEnvironment.environmentSetup?.source === "repository"
                  ? "Setup from repository configuration"
                  : codingEnvironment.environmentSetup?.source === "polychat"
                    ? "Setup configured in Polychat"
                    : "No environment setup commands"}
              </p>
              {codingEnvironment.environmentSetup?.source === "polychat" &&
              (codingEnvironment.environmentSetup.definition.services?.length ?? 0) > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {codingEnvironment.environmentSetup.definition.services?.length} declared{" "}
                  {codingEnvironment.environmentSetup.definition.services?.length === 1
                    ? "service"
                    : "services"}
                </p>
              ) : null}
            </div>
            {canManage && (
              <Button
                variant="outline"
                icon={<Unplug size={15} />}
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </Button>
            )}
          </div>
          {codingEnvironment.environmentSetup || environmentCache ? (
            <div className="rounded-lg border border-border bg-surface-elevated p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Database className="mt-0.5 shrink-0 text-muted-foreground" size={16} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Environment cache</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {!environmentCache
                        ? "A snapshot will be created after the next successful setup."
                        : environmentCache.status === "ready"
                          ? `Created ${formatRelativeTime(environmentCache.createdAt)}${
                              environmentCache.lastUsedAt
                                ? ` · Last used ${formatRelativeTime(environmentCache.lastUsedAt)}`
                                : ""
                            }`
                          : environmentCache.invalidationReason === "manual_rebuild"
                            ? "Rebuild requested. The next run will perform a clean setup."
                            : "The saved snapshot will not be reused."}
                    </p>
                    {environmentCache ? (
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        Repo {environmentCache.repositoryRevision.slice(0, 10)} · Setup{" "}
                        {environmentCache.configurationRevision.slice(0, 10)}
                        {environmentCache.sizeBytes !== undefined
                          ? ` · ${formatBytes(environmentCache.sizeBytes)}`
                          : ""}
                      </p>
                    ) : null}
                    {cacheMessage ? (
                      <output className="mt-1 block text-xs text-attention">{cacheMessage}</output>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={<RotateCcw size={13} />}
                      disabled={isUpdatingCache}
                      onClick={() => void onRebuildCache()}
                    >
                      Rebuild
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      icon={<Trash2 size={13} />}
                      disabled={isUpdatingCache || !environmentCache}
                      onClick={() => void onDeleteCache()}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No repository connected.</p>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="whitespace-nowrap"
              onClick={beginEditing}
            >
              Connect repository
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return embedded ? (
    <section className="border-t border-border p-5">{content}</section>
  ) : (
    <Card className="p-5 shadow-none">{content}</Card>
  );
}
