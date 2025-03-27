import { Blocks } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui";
import { useTools } from "~/hooks/useTools";
import { cn } from "~/lib/utils";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { Tool } from "~/state/stores/toolsStore";

export const ToolSelector = ({
  isDisabled = false,
}: {
  isDisabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: toolsData, isLoading } = useTools();
  const { selectedTools, toggleTool, resetToDefaults, defaultTools } =
    useToolsStore();

  const tools = toolsData?.data || [];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={isDisabled}
        className={cn(
          "flex items-center gap-2 rounded-md py-1.5 px-2.5 transition-colors",
          "text-sm text-zinc-600 dark:text-zinc-400",
          "hover:bg-zinc-100 dark:hover:bg-zinc-800",
          "cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        title="Manage AI tools"
        aria-label="Manage AI tools"
        type="button"
      >
        <Blocks size={16} className="flex-shrink-0" />
        <span className="flex items-center justify-center h-5 min-w-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs px-1">
          {selectedTools.length}
        </span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogClose onClick={() => setIsOpen(false)} />
          <DialogHeader>
            <DialogTitle>Manage AI Tools</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select which tools to enable for the AI. These tools will be used
              to enhance the AI's capabilities.
            </p>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 dark:border-zinc-400 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {tools.map((tool: Tool) => (
                  <div
                    key={tool.id}
                    className={cn(
                      "flex items-start gap-3 border rounded-md p-3 transition-colors",
                      "border-zinc-200 dark:border-zinc-700",
                      "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                    )}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        id={`tool-${tool.id}`}
                        checked={selectedTools.includes(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                        className={cn(
                          "h-4 w-4 rounded focus:ring-offset-1",
                          "border-zinc-300 dark:border-zinc-700",
                          "text-black dark:text-white",
                          "focus:ring-zinc-500 dark:focus:ring-zinc-400",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`tool-${tool.id}`}
                        className="block text-sm font-medium cursor-pointer text-zinc-900 dark:text-zinc-100"
                      >
                        {tool.name}
                        {defaultTools.includes(tool.id) && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium">
                            Default
                          </span>
                        )}
                      </label>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button
                onClick={resetToDefaults}
                variant="secondary"
                className="text-sm"
              >
                Reset to defaults
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="primary"
                className="text-sm"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
