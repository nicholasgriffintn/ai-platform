import {
  ExternalLink,
  FileText,
  Github,
  Keyboard,
  MoreVertical,
  Trash,
} from "lucide-react";
import { Link } from "react-router";

import { DropdownMenu, DropdownMenuItem } from "~/components/ui/DropdownMenu";

interface MoreOptionsDropdownProps {
  position?: "top" | "bottom";
  onShowKeyboardShortcuts: () => void;
  onClearAllMessages: () => void;
}

export const MoreOptionsDropdown = ({
  position = "bottom",
  onShowKeyboardShortcuts,
  onClearAllMessages,
}: MoreOptionsDropdownProps) => {
  return (
    <DropdownMenu
      position={position}
      menuClassName="w-48 rounded-md shadow-lg bg-off-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5"
      trigger={
        <div className="cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
          <MoreVertical size={20} />
          <span className="sr-only">More options</span>
        </div>
      }
    >
      <DropdownMenuItem icon={<FileText size={16} />}>
        <Link to="/terms" className="block w-full">
          Terms
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem icon={<FileText size={16} />}>
        <Link to="/privacy" className="block w-full">
          Privacy
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Github size={16} />}>
        <a
          href="https://github.com/nicholasgriffintn/personal-ai-assistant"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <span className="flex items-center justify-between">
            GitHub <ExternalLink size={16} />
          </span>
        </a>
      </DropdownMenuItem>

      <div className="h-px my-1 bg-zinc-200 dark:bg-zinc-700" />

      <DropdownMenuItem
        icon={<Keyboard size={16} />}
        onClick={onShowKeyboardShortcuts}
      >
        Keyboard Shortcuts
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Trash size={16} />} onClick={onClearAllMessages}>
        Clear All Messages
      </DropdownMenuItem>
    </DropdownMenu>
  );
};
