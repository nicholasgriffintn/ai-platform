import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useEffect, useRef } from "react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  sections: KeyboardShortcutSection[];
}

export interface KeyboardShortcut {
  id: string;
  description: string;
  keys: string[];
}

export interface KeyboardShortcutSection {
  title: string;
  shortcuts: KeyboardShortcut[];
}

function KeyComponent({ keyValue }: { keyValue: string }) {
  return (
    <kbd className="flex min-h-8 min-w-8 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-200">
      <span className="text-zinc-200">{keyValue}</span>
    </kbd>
  );
}

export const KeyboardShortcutsHelp = ({
  isOpen,
  onClose,
  sections,
}: KeyboardShortcutsHelpProps) => {
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
    } else {
      if (previousActiveElement.current && "focus" in previousActiveElement.current) {
        (previousActiveElement.current as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} width="840px">
      <DialogContent className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {section.title}
              </h3>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex min-h-12 items-center justify-between gap-4 py-2"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {shortcut.description}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      {shortcut.keys.map((keyValue) => (
                        <KeyComponent key={`${shortcut.id}-${keyValue}`} keyValue={keyValue} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
