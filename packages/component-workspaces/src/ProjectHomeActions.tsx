import {
  ButtonLink,
  DropdownMenu,
  DropdownMenuItem,
  Link,
} from "@ngriffin_uk/polychat-component-ui";
import { Archive, Ellipsis, LayoutTemplate, Settings2, SquarePen } from "lucide-react";

interface ProjectHomeActionsProps {
  canManage: boolean;
  settingsPath: string;
  conversationPath: string;
  isSavingTemplate: boolean;
  onArchive: () => void;
  onSaveTemplate: () => void;
}

export function ProjectHomeActions({
  canManage,
  settingsPath,
  conversationPath,
  isSavingTemplate,
  onArchive,
  onSaveTemplate,
}: ProjectHomeActionsProps) {
  return (
    <div role="group" aria-label="Project actions" className="flex shrink-0 items-center gap-1">
      {canManage ? (
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
        </DropdownMenu>
      ) : null}

      <Link
        href={settingsPath}
        aria-label="Project settings"
        title="Project settings"
        className="text-muted-foreground hover:text-foreground hover:bg-selection flex h-8 w-8 shrink-0 items-center justify-center rounded-md no-underline transition-colors"
      >
        <Settings2 size={16} />
      </Link>

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
