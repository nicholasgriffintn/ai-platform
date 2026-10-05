import { FormDialog, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { CreateRepositoryKnowledgeSync } from "@ngriffin_uk/polychat-schemas";

import {
  useKnowledgeConnectionForm,
  type KnowledgeRepositoryOption,
} from "./useKnowledgeConnectionForm";

interface KnowledgeConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  repositories: KnowledgeRepositoryOption[];
  isPending: boolean;
  onCreate: (input: CreateRepositoryKnowledgeSync) => Promise<void>;
}

export function KnowledgeConnectionForm({
  open,
  onOpenChange,
  projectId,
  repositories,
  isPending,
  onCreate,
}: KnowledgeConnectionFormProps) {
  const form = useKnowledgeConnectionForm({
    projectId,
    repositories,
    onCreate,
    onCreated: () => onOpenChange(false),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sync repository knowledge"
      description="Keep Markdown and text documents current using your existing GitHub connection."
      submitText="Start sync"
      isLoading={isPending}
      submitDisabled={!form.repository || !form.branch.trim()}
      onSubmit={form.submit}
    >
      <FormSelect
        label="Repository"
        value={form.selection}
        onValueChange={form.setSelection}
        options={repositories.map((item) => ({ value: item.key, label: item.repo }))}
        placeholder="Choose a connected repository"
      />
      <FormInput
        label="Branch"
        value={form.branch}
        onChange={(event) => form.setBranch(event.target.value)}
        required
      />
      <FormInput
        label="Documentation path"
        value={form.path}
        onChange={(event) => form.setPath(event.target.value)}
        description="Leave empty for the repository root. Binary files, symlinks and submodules are excluded."
      />
      <p className="text-sm text-muted-foreground">
        {projectId
          ? "Project imports require a public repository because project conversation history is shared. Use personal sources for private repositories."
          : "Imported documents remain private to your account."}
      </p>
      {form.error ? (
        <p role="alert" className="text-sm text-destructive">
          {form.error}
        </p>
      ) : null}
    </FormDialog>
  );
}
