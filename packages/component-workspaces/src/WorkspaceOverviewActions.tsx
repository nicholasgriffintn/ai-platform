import { Button, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { Ellipsis, Plus, Trash2, Users } from "lucide-react";

interface WorkspaceOverviewActionsProps {
  isOwner: boolean;
  onCreateProject: () => void;
  onDeleteWorkspace: () => void;
  onInvite: () => void;
}

export function WorkspaceOverviewActions({
  isOwner,
  onCreateProject,
  onDeleteWorkspace,
  onInvite,
}: WorkspaceOverviewActionsProps) {
  return (
    <div role="group" aria-label="Workspace actions" className="flex shrink-0 items-center gap-1">
      <DropdownMenu
        position="bottom"
        menuClassName="!left-auto right-0 w-48"
        trigger={<Ellipsis size={18} />}
        buttonProps={{
          variant: "icon",
          className: "h-8 w-8 shrink-0 p-1.5",
          "aria-label": "More workspace actions",
          title: "More workspace actions",
        }}
      >
        <DropdownMenuItem onClick={onInvite} icon={<Users size={16} />}>
          Invite
        </DropdownMenuItem>
        {isOwner ? (
          <DropdownMenuItem
            onClick={onDeleteWorkspace}
            className="text-red-700 dark:text-red-400"
            icon={<Trash2 size={16} />}
          >
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenu>

      <Button
        variant="primary"
        size="sm"
        className="h-8 w-8 shrink-0 px-0 xl:w-auto xl:px-3"
        aria-label="New project"
        title="New project"
        onClick={onCreateProject}
      >
        <span className="flex items-center gap-2">
          <Plus size={16} />
          <span className="hidden xl:inline">New project</span>
        </span>
      </Button>
    </div>
  );
}
