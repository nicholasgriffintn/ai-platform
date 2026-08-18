import { Button } from "@ngriffin_uk/polychat-component-ui";
import { GitBranch } from "lucide-react";

export interface ConversationTitleContextProps {
  title: string;
  parentConversationId?: string | null;
  onOpenParent?: (parentConversationId: string) => void;
}

export function ConversationTitleContext({
  title,
  parentConversationId,
  onOpenParent,
}: ConversationTitleContextProps) {
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm sm:gap-1.5">
      {parentConversationId ? (
        <Button
          variant="icon"
          className="h-8 w-8 shrink-0 p-1.5"
          title="Go to original conversation"
          aria-label="Go to original conversation"
          icon={<GitBranch className="h-3.5 w-3.5" />}
          onClick={() => onOpenParent?.(parentConversationId)}
        />
      ) : null}
      <span
        className="truncate font-medium text-zinc-800 dark:text-zinc-200"
        data-dynamic-copy=""
        title={title}
      >
        {title}
      </span>
    </div>
  );
}
