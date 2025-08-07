import { Code, Layers, Search } from "lucide-react";
import * as React from "react";

import { Toggle } from "~/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useModels } from "~/hooks/useModels";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";

export const ToolToggles = ({
  isDisabled = false,
}: {
  isDisabled?: boolean;
}) => {
  const { model, chatMode, isPro, useMultiModel, setUseMultiModel } =
    useChatStore();
  const { selectedTools, setSelectedTools } = useToolsStore();
  const { data: apiModels } = useModels();

  const modelCapabilities = model ? apiModels?.[model] : undefined;

  const supportsToolCalls = modelCapabilities?.supportsToolCalls;
  const supportsSearchGrounding = modelCapabilities?.supportsSearchGrounding;
  const supportsCodeExecution = modelCapabilities?.supportsCodeExecution;

  const availableTools = React.useMemo(() => {
    const tools: string[] = [];
    if (supportsCodeExecution) tools.push("code_execution");
    if (supportsSearchGrounding) tools.push("search_grounding");
    return tools;
  }, [supportsCodeExecution, supportsSearchGrounding]);

  const handleValueChange = (value: string[]) => {
    setSelectedTools(value);
  };

  return (
    <div className="flex items-center">
      {isPro && !model && chatMode === "remote" && (
        <div className="flex items-center gap-1.5 ml-1">
          <Toggle
            pressed={useMultiModel}
            onPressedChange={setUseMultiModel}
            disabled={isDisabled}
            title="Toggle multi-model mode"
            aria-label="Toggle multi-model mode"
            size="sm"
          >
            <Layers className="h-3 w-3" />
          </Toggle>
        </div>
      )}

      {supportsToolCalls && availableTools.length !== 0 ? (
        <>
          <ToggleGroup
            type="multiple"
            size="sm"
            value={selectedTools.filter((tool) =>
              availableTools.includes(tool),
            )}
            onValueChange={handleValueChange}
            disabled={isDisabled}
            aria-label="Select tools"
            className="ml-1"
          >
            {supportsCodeExecution && (
              <ToggleGroupItem
                value="code_execution"
                aria-label="Toggle code execution"
                title={
                  selectedTools.includes("code_execution")
                    ? "Disable code execution"
                    : "Enable code execution"
                }
              >
                <Code className="h-4 w-4" />
              </ToggleGroupItem>
            )}
            {supportsSearchGrounding && (
              <ToggleGroupItem
                value="search_grounding"
                aria-label="Toggle search grounding"
                title={
                  selectedTools.includes("search_grounding")
                    ? "Disable search grounding"
                    : "Enable search grounding"
                }
              >
                <Search className="h-4 w-4" />
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </>
      ) : null}
    </div>
  );
};
