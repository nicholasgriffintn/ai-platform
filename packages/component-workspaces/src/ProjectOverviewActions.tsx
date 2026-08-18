import { DropdownMenu, DropdownMenuItem, Link } from "@ngriffin_uk/polychat-component-ui";
import { Archive, Ellipsis, LayoutTemplate, Settings2, SquarePen } from "lucide-react";

interface ProjectOverviewActionsProps {
  canManage: boolean;
  capabilitiesPath: string;
  conversationPath: string;
  isSavingTemplate: boolean;
  onArchive: () => void;
  onSaveTemplate: () => void;
}

export function ProjectOverviewActions({
  canManage,
  capabilitiesPath,
  conversationPath,
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
              className="text-red-700 dark:text-red-400"
              icon={<Archive size={16} />}
            >
              Archive
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem asChild icon={<Settings2 size={16} />}>
          <Link href={capabilitiesPath}>Capabilities</Link>
        </DropdownMenuItem>
      </DropdownMenu>

      <Link
        href={conversationPath}
        aria-label="New conversation"
        className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-2 text-sm font-medium text-white no-underline shadow-sm transition-colors hover:bg-blue-700 hover:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 xl:px-3"
      >
        <SquarePen size={16} />
        <span className="hidden xl:inline">New conversation</span>
      </Link>
    </div>
  );
}
