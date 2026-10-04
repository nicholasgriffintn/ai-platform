import {
  useProjectTaskIntegrations,
  useRecipeConnectorAccounts,
  useSandboxConnections,
  useSandboxRepositoryOptions,
} from "@ngriffin_uk/polychat-library-react";
import {
  createProjectTaskSchema,
  issueLocatorSchema,
  type IssueLocator,
  type IssuePreview,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useIssueImportForm(projectId: string, onImported: (taskId: string) => void) {
  const { preview, importIssue } = useProjectTaskIntegrations(projectId);
  const [provider, setProvider] = useState<"github" | "linear">("github");
  const [repositoryKey, setRepositoryKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [issueId, setIssueId] = useState("");
  const connections = useSandboxConnections();
  const repositories = useSandboxRepositoryOptions(connections.data ?? []);
  const accounts = useRecipeConnectorAccounts("linear");
  const activeAccounts =
    accounts.data?.accounts.filter(
      (account) => account.status === "ACTIVE" && !account.isDisabled,
    ) ?? [];
  const repository = repositoryKey
    ? repositories.repoOptions.find((option) => option.key === repositoryKey)
    : repositories.repoOptions[0];
  const selectedAccountId =
    accountId ||
    activeAccounts.find((account) => account.isSelected)?.id ||
    activeAccounts[0]?.id ||
    "";
  const locator =
    provider === "github"
      ? {
          provider,
          installationId: repository?.installationId,
          repository: repository?.repo,
          issueNumber: Number(issueId),
        }
      : { provider, connectedAccountId: selectedAccountId, issueId };
  const connectionError =
    provider === "github" ? (connections.error ?? repositories.error) : accounts.error;

  const [loaded, setLoaded] = useState<{ locator: IssueLocator; preview: IssuePreview } | null>(
    null,
  );
  const [objective, setObjective] = useState("");
  const [criteria, setCriteria] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    setLoaded(null);
    setError(null);
  };

  const load = async (input: unknown) => {
    setError(null);
    setLoaded(null);
    try {
      const parsedLocator = issueLocatorSchema.parse(input);
      const result = await preview.mutateAsync(parsedLocator);

      setLoaded({ locator: parsedLocator, preview: result });
      setObjective(`Implement ${result.issue.identifier}: ${result.issue.title}`.slice(0, 2000));
      setCriteria("");
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to read this issue"));
    }
  };

  const submit = async () => {
    if (!loaded || importIssue.isPending) {
      return;
    }

    setError(null);
    try {
      const task = createProjectTaskSchema.parse({
        objective,
        acceptanceCriteria: splitNonEmptyLines(criteria).map((text) => ({ text })),
        expectedOutput: "A reviewed implementation with validation evidence",
      });
      const result = await importIssue.mutateAsync({
        locator: loaded.locator,
        expectedRevision: loaded.preview.issue.revision,
        task,
      });

      onImported(result.task.id);
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to import this issue"));
    }
  };

  return {
    provider,
    setProvider,
    setRepositoryKey,
    setAccountId,
    issueId,
    setIssueId,
    repositories,
    accounts,
    activeAccounts,
    repository,
    selectedAccountId,
    locator,
    connectionError,
    loaded,
    objective,
    setObjective,
    criteria,
    setCriteria,
    error,
    reset,
    load,
    submit,
    pending: preview.isPending || importIssue.isPending,
  };
}
