import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReviewPolicy } from "@ngriffin_uk/polychat-schemas";

import { useReviewSettings } from "./useReviewSettings";

export function ProjectReviewSettingsDialog({
  projectId,
  policies,
  canManage,
  onClose,
}: {
  projectId: string;
  policies: ReviewPolicy[];
  canManage: boolean;
  onClose: () => void;
}) {
  const {
    currentUserId,
    disablePolicy,
    repository,
    repositories,
    setRepositoryKey,
    prNumber,
    setPrNumber,
    enabled,
    setEnabled,
    tokenBudget,
    setTokenBudget,
    error,
    pending,
    start,
    save,
  } = useReviewSettings(projectId, policies, onClose);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>GitHub PR review</DialogTitle>
          <DialogDescription>
            Review a captured commit diff in Work. Reviews report missing context and never run
            repository code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormSelect
            label="Repository"
            value={repository?.key ?? ""}
            options={repositories.repoOptions.map((option) => ({
              value: option.key,
              label: option.repo,
            }))}
            onValueChange={setRepositoryKey}
            disabled={pending || repositories.isLoading}
          />
          <FormInput
            label="Pull request number"
            value={prNumber}
            placeholder="42"
            onChange={(event) => setPrNumber(event.target.value)}
            disabled={pending}
          />
          <Button
            variant="primary"
            disabled={pending || !repository || !prNumber}
            onClick={() => void start()}
          >
            Review PR
          </Button>
          {canManage ? (
            <div className="space-y-3 border-t border-border pt-4">
              <label htmlFor="automatic-pr-review" className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="automatic-pr-review"
                  checked={enabled}
                  onCheckedChange={(value) => setEnabled(value === true)}
                  disabled={pending}
                />
                Review new PR revisions automatically
              </label>
              <p className="text-xs text-muted-foreground">
                Runs with your connection and project authority. Draft PRs are skipped. Each commit
                revision has its own task; publishing still requires a separate approval.
              </p>
              <FormInput
                label="Token budget per automatic review"
                type="number"
                min={1000}
                max={100000}
                value={tokenBudget}
                onChange={(event) => setTokenBudget(event.target.value)}
                disabled={pending}
              />
              <Button
                variant="outline"
                disabled={pending || (enabled && !repository)}
                onClick={() => void save()}
              >
                Save automatic review settings
              </Button>
            </div>
          ) : null}
          {canManage
            ? policies
                .filter((policy) => policy.enabled)
                .map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm"
                  >
                    <div>
                      <p>
                        {policy.repository} · {policy.provider}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {policy.ownerUserId === currentUserId
                          ? "Your connection"
                          : "Another member's connection"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => void disablePolicy(policy.id)}
                    >
                      Disable
                    </Button>
                  </div>
                ))
            : null}
          {error ? (
            <p role="alert" className="text-sm text-failure">
              {error}
            </p>
          ) : null}
          {!repository && !repositories.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Connect GitHub in coding settings to review pull requests.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
