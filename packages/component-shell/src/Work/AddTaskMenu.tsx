import { Button, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { ChevronDown, GitPullRequestArrow, Plus } from "lucide-react";

export function AddTaskMenu({
  onAddTask,
  onImportIssue,
}: {
  onAddTask: () => void;
  onImportIssue: () => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-stretch rounded-md shadow-sm">
      <Button
        variant="primary"
        size="sm"
        collapseLabel
        className="rounded-r-none shadow-none"
        aria-label="Add a task"
        title="Add a task"
        icon={<Plus size={16} />}
        onClick={onAddTask}
      >
        Add a task
      </Button>
      <DropdownMenu
        position="bottom"
        className="flex"
        menuClassName="!left-auto right-0 w-60"
        trigger={<ChevronDown size={15} />}
        buttonProps={{
          variant: "primary",
          size: "sm",
          className: "h-full rounded-l-none border-0 px-2 shadow-[inset_1px_0_0_rgb(0_0_0/0.18)]",
          "aria-label": "More ways to add work",
          title: "More ways to add work",
        }}
      >
        <DropdownMenuItem icon={<GitPullRequestArrow size={15} />} onClick={onImportIssue}>
          Import a GitHub issue
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}
