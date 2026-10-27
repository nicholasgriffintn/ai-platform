import { DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { Archive, Ellipsis, LayoutTemplate } from "lucide-react";

interface ProjectHomeActionsProps {
  canManage: boolean;
  isSavingTemplate: boolean;
  onArchive: () => void;
  onSaveTemplate: () => void;
}

export function ProjectHomeActions({
  canManage,
  isSavingTemplate,
  onArchive,
  onSaveTemplate,
}: ProjectHomeActionsProps) {
  if (!canManage) {
    return null;
  }

  return (
    <DropdownMenu
      position="bottom"
      menuClassName="!left-auto right-0 w-56"
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
        {isSavingTemplate ? "Saving template…" : "Save as template"}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onArchive} className="text-failure" icon={<Archive size={16} />}>
        Archive project
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
