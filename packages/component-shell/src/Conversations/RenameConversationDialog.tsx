import { FormDialog, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

export interface RenameConversationTarget {
  id: string;
  title: string;
}

export interface RenameConversationDialogProps {
  target: RenameConversationTarget | null;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (id: string, title: string) => Promise<void>;
}

export function RenameConversationDialog(props: RenameConversationDialogProps) {
  return <RenameConversationDialogContent key={props.target?.id ?? "closed"} {...props} />;
}

function RenameConversationDialogContent({
  target,
  isSaving = false,
  onOpenChange,
  onRename,
}: RenameConversationDialogProps) {
  const [title, setTitle] = useState(target?.title ?? "");
  const trimmed = title.trim();
  const unchanged = !target || trimmed === target.title.trim();

  return (
    <FormDialog
      open={target !== null}
      onOpenChange={onOpenChange}
      title="Rename conversation"
      submitText="Rename"
      isLoading={isSaving}
      submitDisabled={!trimmed || unchanged}
      onSubmit={async () => {
        if (!target || !trimmed || unchanged) {
          return;
        }

        await onRename(target.id, trimmed);
      }}
    >
      <FormInput
        label="Title"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
      />
    </FormDialog>
  );
}
