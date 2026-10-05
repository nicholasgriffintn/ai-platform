import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useProjectTaskIntegrations,
  useSandboxConnections,
  useSandboxRepositoryOptions,
} from "@ngriffin_uk/polychat-library-react";
import {
  reviewPolicyInputSchema,
  pullRequestLocatorSchema,
  type ReviewPolicy,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useReviewSettings(
  projectId: string,
  policies: readonly ReviewPolicy[],
  onClose: () => void,
) {
  const currentUserId = useChatStore((state) => state.user?.id);
  const initialPolicy = policies.find(
    (policy) => policy.provider === "github" && policy.ownerUserId === currentUserId,
  );
  const connections = useSandboxConnections();
  const repositories = useSandboxRepositoryOptions(connections.data ?? []);
  const [repositoryKey, setRepositoryKey] = useState(
    initialPolicy ? `${initialPolicy.accountId}:${initialPolicy.repository}` : "",
  );
  const [prNumber, setPrNumber] = useState("");
  const [enabled, setEnabled] = useState(initialPolicy?.enabled ?? false);
  const [tokenBudget, setTokenBudget] = useState(String(initialPolicy?.tokenBudget ?? 20000));
  const [error, setError] = useState<string | null>(null);
  const { savePolicy, startReview } = useProjectTaskIntegrations(projectId);
  const repository = repositoryKey
    ? repositories.repoOptions.find((option) => option.key === repositoryKey)
    : repositories.repoOptions[0];
  const policy = policies.find(
    (candidate) =>
      candidate.provider === "github" &&
      candidate.accountId === String(repository?.installationId) &&
      candidate.repository === repository?.repo &&
      candidate.ownerUserId === currentUserId,
  );
  const changeRepository = (key: string) => {
    setRepositoryKey(key);
    const selected = repositories.repoOptions.find((option) => option.key === key);
    const existing = policies.find(
      (candidate) =>
        candidate.provider === "github" &&
        candidate.accountId === String(selected?.installationId) &&
        candidate.repository === selected?.repo &&
        candidate.ownerUserId === currentUserId,
    );

    setEnabled(existing?.enabled ?? false);
    setTokenBudget(String(existing?.tokenBudget ?? 20000));
  };

  const disablePolicy = async (id: string) => {
    if (savePolicy.isPending) {
      return;
    }

    setError(null);
    try {
      await savePolicy.mutateAsync({ enabled: false, id });
      onClose();
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to disable automatic review"));
    }
  };

  const start = async () => {
    if (startReview.isPending) {
      return;
    }

    setError(null);
    try {
      await startReview.mutateAsync(
        pullRequestLocatorSchema.parse({
          provider: "github",
          accountId: repository ? String(repository.installationId) : undefined,
          repository: repository?.repo,
          pullRequestNumber: Number(prNumber),
        }),
      );
      onClose();
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to start the review"));
    }
  };

  const save = async () => {
    if (savePolicy.isPending) {
      return;
    }

    if (!enabled && !policy) {
      onClose();

      return;
    }

    setError(null);
    try {
      await savePolicy.mutateAsync(
        reviewPolicyInputSchema.parse(
          enabled
            ? {
                enabled: true,
                provider: "github",
                accountId: repository ? String(repository.installationId) : undefined,
                repository: repository?.repo,
                tokenBudget: Number(tokenBudget),
              }
            : { enabled: false, id: policy?.id },
        ),
      );
      onClose();
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to save automatic review settings"));
    }
  };

  return {
    repository,
    repositories,
    repositoryKey,
    setRepositoryKey: changeRepository,
    currentUserId,
    disablePolicy,
    prNumber,
    setPrNumber,
    enabled,
    setEnabled,
    tokenBudget,
    setTokenBudget,
    start,
    save,
    pending: savePolicy.isPending || startReview.isPending,
    error: error || connections.error?.message || repositories.error?.message,
  };
}
