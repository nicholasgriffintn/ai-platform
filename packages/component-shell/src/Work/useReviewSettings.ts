import {
  useProjectTaskIntegrations,
  useSandboxConnections,
  useSandboxRepositoryOptions,
} from "@ngriffin_uk/polychat-library-react";
import {
  githubReviewPolicyInputSchema,
  pullRequestLocatorSchema,
  type GithubReviewPolicy,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useReviewSettings(
  projectId: string,
  policy: GithubReviewPolicy | null,
  onClose: () => void,
) {
  const connections = useSandboxConnections();
  const repositories = useSandboxRepositoryOptions(connections.data ?? []);
  const [repositoryKey, setRepositoryKey] = useState(
    policy ? `${policy.installationId}:${policy.repository}` : "",
  );
  const [prNumber, setPrNumber] = useState("");
  const [enabled, setEnabled] = useState(policy?.enabled ?? false);
  const [tokenBudget, setTokenBudget] = useState(String(policy?.tokenBudget ?? 20000));
  const [error, setError] = useState<string | null>(null);
  const { savePolicy, startReview } = useProjectTaskIntegrations(projectId);
  const repository =
    repositories.repoOptions.find((option) => option.key === repositoryKey) ??
    repositories.repoOptions[0];
  const start = async () => {
    if (startReview.isPending) {
      return;
    }

    setError(null);
    try {
      await startReview.mutateAsync(
        pullRequestLocatorSchema.parse({
          installationId: repository?.installationId,
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

    setError(null);
    try {
      await savePolicy.mutateAsync(
        githubReviewPolicyInputSchema.parse(
          enabled
            ? {
                enabled: true,
                installationId: repository?.installationId,
                repository: repository?.repo,
                tokenBudget: Number(tokenBudget),
              }
            : { enabled: false },
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
    setRepositoryKey,
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
