import {
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuSeparator,
} from "@ngriffin_uk/polychat-component-ui";
import { Edit, MoreHorizontal, Tags, Trash2 } from "lucide-react";

export interface ConversationListItemActionsProps {
  conversationId: string;
  title: string;
  canOrganise: boolean;
  onEditTitle: (conversationId: string, currentTitle: string) => void;
  onDelete: (conversationId: string) => void;
  onOrganise?: (conversationId: string) => void;
}

export function ConversationListItemActions({
  conversationId,
  title,
  canOrganise,
  onEditTitle,
  onDelete,
  onOrganise,
}: ConversationListItemActionsProps) {
  return (
    <div
      data-hover-actions=""
      className="absolute right-2 z-20 flex items-center bg-inherit opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:has-[[data-state=open]]:opacity-100"
    >
      <OptionsMenu
        align="end"
        trigger={
          <button
            type="button"
            className="text-muted-foreground hover:bg-selection hover:text-foreground data-[state=open]:bg-selection data-[state=open]:text-foreground focus-visible:outline-ring flex size-8 items-center justify-center rounded-lg border-0 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Conversation actions"
            title="Conversation actions"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        }
      >
        {canOrganise && onOrganise && (
          <OptionsMenuAction onSelect={() => onOrganise(conversationId)}>
            <Tags size={14} className="mr-2 shrink-0" aria-hidden="true" />
            Organise
          </OptionsMenuAction>
        )}
        {canOrganise && onOrganise && <OptionsMenuSeparator />}
        <OptionsMenuAction onSelect={() => onEditTitle(conversationId, title)}>
          <Edit size={14} className="mr-2 shrink-0" aria-hidden="true" />
          Rename
        </OptionsMenuAction>
        <OptionsMenuAction
          className="text-destructive data-[highlighted]:text-destructive"
          onSelect={() => onDelete(conversationId)}
        >
          <Trash2 size={14} className="mr-2 shrink-0" aria-hidden="true" />
          Delete
        </OptionsMenuAction>
      </OptionsMenu>
    </div>
  );
}
