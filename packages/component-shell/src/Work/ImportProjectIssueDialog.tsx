import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";

import { useIssueImportForm } from "./useIssueImportForm.js";

export function ImportProjectIssueDialog({
  projectId,
  taskBasePath,
  onClose,
  onImported,
}: {
  projectId: string;
  taskBasePath: string;
  onClose: () => void;
  onImported: (taskId: string) => void;
}) {
  const form = useIssueImportForm(projectId, onImported);
  const {
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
  } = form;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import an issue</DialogTitle>
          <DialogDescription>
            Read an issue through your connection, then review its task plan. Its content is
            retained as a snapshot in this project.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          <FormSelect
            label="Issue service"
            value={provider}
            options={[
              { value: "github", label: "GitHub" },
              { value: "linear", label: "Linear" },
            ]}
            disabled={form.pending}
            onValueChange={(value) => {
              setProvider(value);
              form.reset();
            }}
          />
          {provider === "github" ? (
            <FormSelect
              label="Repository"
              value={repository?.key ?? ""}
              disabled={form.pending || repositories.isLoading}
              options={repositories.repoOptions.map((option) => ({
                value: option.key,
                label: option.repo,
              }))}
              onValueChange={(value) => {
                setRepositoryKey(value);
                form.reset();
              }}
            />
          ) : (
            <FormSelect
              label="Linear account"
              value={selectedAccountId}
              disabled={form.pending}
              options={activeAccounts.map((account) => ({
                value: account.id,
                label: account.alias || account.id,
              }))}
              onValueChange={(value) => {
                setAccountId(value);
                form.reset();
              }}
            />
          )}
          <FormInput
            label={provider === "github" ? "Issue number" : "Issue ID or identifier"}
            placeholder={provider === "github" ? "42" : "ENG-42"}
            value={issueId}
            disabled={form.pending}
            onChange={(event) => {
              setIssueId(event.target.value);
              form.reset();
            }}
          />
          {connectionError ? (
            <p role="alert" className="text-sm text-failure">
              {connectionError.message}
            </p>
          ) : null}
          {(provider === "github" && !repository && !repositories.isLoading) ||
          (provider === "linear" && !selectedAccountId && !accounts.isLoading) ? (
            <p className="text-sm text-muted-foreground">
              Connect {provider === "github" ? "GitHub in coding settings" : "Linear in Apps"} to
              import an issue.
            </p>
          ) : null}
          <Button
            variant="outline"
            disabled={
              form.pending ||
              !issueId.trim() ||
              (provider === "github" ? !repository : !selectedAccountId)
            }
            onClick={() => void form.load(locator)}
          >
            {form.pending ? "Working…" : "Read issue"}
          </Button>
          {form.loaded ? (
            <div className="space-y-4 border-t border-border pt-4">
              <a
                className="text-link text-sm"
                href={form.loaded.preview.issue.url}
                target="_blank"
                rel="noreferrer"
              >
                {form.loaded.preview.issue.identifier}: {form.loaded.preview.issue.title}
              </a>
              <pre className="max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                {form.loaded.preview.issue.description || "No description provided."}
              </pre>
              {form.loaded.preview.existingTaskId ? (
                <p className="text-sm">
                  This issue is already imported.{" "}
                  <a
                    className="text-link"
                    href={`${taskBasePath}/${form.loaded.preview.existingTaskId}`}
                  >
                    Open its task
                  </a>
                  .
                </p>
              ) : (
                <>
                  <FormTextarea
                    label="Objective"
                    value={form.objective}
                    maxLength={2000}
                    disabled={form.pending}
                    onChange={(event) => form.setObjective(event.target.value)}
                  />
                  <FormTextarea
                    label="Acceptance criteria"
                    description="One criterion per line. Review these before importing; the issue description is kept separately."
                    value={form.criteria}
                    disabled={form.pending}
                    onChange={(event) => form.setCriteria(event.target.value)}
                  />
                </>
              )}
            </div>
          ) : null}
          {form.error ? (
            <p role="alert" className="text-sm text-failure">
              {form.error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            disabled={
              form.pending ||
              !form.loaded ||
              Boolean(form.loaded.preview.existingTaskId) ||
              !form.objective.trim()
            }
            onClick={() => void form.submit()}
          >
            Import task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
