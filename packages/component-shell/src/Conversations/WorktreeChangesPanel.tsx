import { RunChangesView } from "@ngriffin_uk/polychat-component-content";
import { Button, FormInput, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import { useAgentWorktree } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest } from "lucide-react";
import { useState, type FormEvent } from "react";

interface WorktreeChangesPanelProps {
  conversationId: string;
  conversationTitle: string;
  revision: number;
}

export function WorktreeChangesPanel({
  conversationId,
  conversationTitle,
  revision,
}: WorktreeChangesPanelProps) {
  const workspace = useAgentWorktree(conversationId, revision);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(conversationTitle);
  const [body, setBody] = useState("");
  const { worktree, changes } = workspace;

  if (!worktree) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {workspace.isLoading
          ? "Looking for this conversation's branch…"
          : "This conversation isn't working in a git branch of its own."}
      </p>
    );
  }

  const hasChanges = (changes?.files.length ?? 0) > 0;
  const submitCommit = (event: FormEvent) => {
    event.preventDefault();
    workspace.commit.mutate(message, { onSuccess: () => setMessage("") });
  };

  const submitPullRequest = (event: FormEvent) => {
    event.preventDefault();
    workspace.pullRequest.mutate({ title, body });
  };

  return (
    <div className="space-y-4 p-3">
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <GitBranch size={16} aria-hidden="true" />
          <span className="truncate font-mono">{worktree.branch}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          From {worktree.baseBranch ?? "a detached commit"} · {worktree.path}
        </p>
      </div>

      <form onSubmit={submitCommit} className="space-y-2">
        <FormTextarea
          label="Commit message"
          value={message}
          rows={2}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          icon={<GitCommitHorizontal size={14} />}
          disabled={!message.trim() || !hasChanges || workspace.commit.isPending}
        >
          Commit
        </Button>
        {workspace.commit.error ? (
          <p className="text-xs text-failure">
            {getErrorMessage(workspace.commit.error, "The commit didn't go through.")}
          </p>
        ) : null}
      </form>

      <form onSubmit={submitPullRequest} className="space-y-2">
        <FormInput
          label="Pull request title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <FormTextarea
          label="Description"
          value={body}
          rows={3}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          icon={<GitPullRequest size={14} />}
          disabled={!title.trim() || workspace.pullRequest.isPending}
        >
          {workspace.pullRequest.data ? "Update pull request" : "Open pull request"}
        </Button>
        {workspace.pullRequest.data ? (
          <a
            href={workspace.pullRequest.data.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink size={12} aria-hidden="true" />
            {workspace.pullRequest.data.repository}#{workspace.pullRequest.data.number}
          </a>
        ) : null}
        {workspace.pullRequest.error ? (
          <p className="text-xs text-failure">
            {getErrorMessage(workspace.pullRequest.error, "The pull request didn't go through.")}
          </p>
        ) : null}
      </form>

      <RunChangesView
        content={
          changes
            ? {
                text: changes.patch,
                contentType: "text/x-diff; charset=utf-8",
                truncated: changes.truncated,
                binary: false,
              }
            : undefined
        }
        recordedFiles={changes?.files.map((file) => file.path)}
        isLoading={workspace.isLoading}
        errorMessage={
          workspace.error
            ? getErrorMessage(workspace.error, "The branch's changes couldn't be read.")
            : undefined
        }
      />
    </div>
  );
}
