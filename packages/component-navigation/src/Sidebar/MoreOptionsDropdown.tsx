import { DropdownMenu, DropdownMenuItem, Link } from "@ngriffin_uk/polychat-component-ui";
import { ExternalLink, FileText, Keyboard, MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

export interface MoreOptionsDropdownProps {
  position?: "top" | "bottom";
  privacyHref: string;
  termsHref: string;
  sourceCodeUrl: string;
  sourceCodeIcon: ReactNode;
  onShowKeyboardShortcuts: () => void;
}

export function MoreOptionsDropdown({
  position = "bottom",
  privacyHref,
  termsHref,
  sourceCodeUrl,
  sourceCodeIcon,
  onShowKeyboardShortcuts,
}: MoreOptionsDropdownProps) {
  return (
    <DropdownMenu
      position={position}
      menuClassName="w-48 rounded-md"
      trigger={
        <div className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex cursor-pointer items-center justify-center rounded-md p-2">
          <MoreVertical size={20} />
          <span className="sr-only">More options</span>
        </div>
      }
    >
      <DropdownMenuItem icon={<FileText size={16} />} asChild>
        <Link href={termsHref} className="block w-full no-underline">
          Terms
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem icon={<FileText size={16} />} asChild>
        <Link href={privacyHref} className="block w-full no-underline">
          Privacy
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={
          <span aria-hidden="true" className="inline-flex">
            {sourceCodeIcon}
          </span>
        }
        asChild
      >
        <a
          href={sourceCodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full no-underline"
        >
          <span className="flex items-center justify-between">
            GitHub <ExternalLink size={16} />
          </span>
        </a>
      </DropdownMenuItem>

      <div className="bg-border my-1 h-px" />

      <DropdownMenuItem icon={<Keyboard size={16} />} onClick={onShowKeyboardShortcuts}>
        Keyboard Shortcuts
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
