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
        collapseLabel="xl"
        className="shrink-0"
        aria-label="New project"
        title="New project"
        icon={<Plus size={16} />}
        onClick={onCreateProject}
      >
        New project
      </Button>
    </div>
  );
}
