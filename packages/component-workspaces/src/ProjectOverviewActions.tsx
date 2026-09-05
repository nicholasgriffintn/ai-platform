import {
  ButtonLink,
  DropdownMenu,
  DropdownMenuItem,
  Link,
} from "@ngriffin_uk/polychat-component-ui";
import { Archive, Ellipsis, LayoutTemplate, ListChecks, Settings2, SquarePen } from "lucide-react";

interface ProjectOverviewActionsProps {
  canManage: boolean;
  capabilitiesPath: string;
  conversationPath: string;
  tasksPath: string;
  isSavingTemplate: boolean;
  onArchive: () => void;
  onSaveTemplate: () => void;
}

export function ProjectOverviewActions({
  canManage,
  capabilitiesPath,
  conversationPath,
  tasksPath,
  isSavingTemplate,
  onArchive,
  onSaveTemplate,
}: ProjectOverviewActionsProps) {
  return (
    <div role="group" aria-label="Project actions" className="flex shrink-0 items-center gap-1">
      <DropdownMenu
        position="bottom"
        menuClassName="!left-auto right-0 w-52"
        trigger={<Ellipsis size={18} />}
        buttonProps={{
          variant: "icon",
          className: "h-8 w-8 shrink-0 p-1.5",
          "aria-label": "More project actions",
          title: "More project actions",
        }}
      >
        {canManage ? (
          <>
            <DropdownMenuItem
              onClick={onSaveTemplate}
              disabled={isSavingTemplate}
              icon={<LayoutTemplate size={16} />}
            >
              {isSavingTemplate ? "Saving template…" : "Save template"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onArchive}
              className="text-failure"
              icon={<Archive size={16} />}
            >
              Archive
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem asChild icon={<ListChecks size={16} />}>
          <Link href={tasksPath}>Tasks</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild icon={<Settings2 size={16} />}>
          <Link href={capabilitiesPath}>Capabilities</Link>
        </DropdownMenuItem>
      </DropdownMenu>

      <ButtonLink
        variant="primary"
        size="sm"
        collapseLabel
        href={conversationPath}
        aria-label="New conversation"
        title="New conversation"
        className="shrink-0"
        icon={<SquarePen size={16} />}
      >
        New conversation
      </ButtonLink>
    </div>
  );
}
