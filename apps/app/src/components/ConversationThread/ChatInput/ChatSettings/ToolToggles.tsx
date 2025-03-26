import { Code, Search } from "lucide-react";

import { Button } from "~/components/ui";
import { useModels } from "~/hooks/useModels";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";

export const ToolToggles = ({
  isDisabled = false,
}: {
  isDisabled?: boolean;
}) => {
  const { model } = useChatStore();
  const { toggleTool, selectedTools } = useToolsStore();
  const { data: apiModels } = useModels();

  const supportsFunctions = apiModels?.[model]?.supportsFunctions;
  const supportsSearchGrounding = apiModels?.[model]?.supportsSearchGrounding;
  const supportsCodeExecution = apiModels?.[model]?.supportsCodeExecution;

  const toggleCodeExecution = () => {
    if (!supportsCodeExecution) return;

    toggleTool("code_execution");
  };

  const toggleSearchGrounding = () => {
    if (!supportsSearchGrounding) return;

    toggleTool("search_grounding");
  };

  if (!supportsFunctions) return null;

  return (
    <div className="flex items-center">
      {supportsCodeExecution && (
        <Button
          variant={
            selectedTools.includes("code_execution") ? "iconActive" : "icon"
          }
          icon={<Code className="h-4 w-4" />}
          onClick={toggleCodeExecution}
          disabled={isDisabled}
          title={
            selectedTools.includes("code_execution")
              ? "Disable code execution"
              : "Enable code execution"
          }
          aria-label={
            selectedTools.includes("code_execution")
              ? "Disable code execution"
              : "Enable code execution"
          }
        />
      )}

      {supportsSearchGrounding && (
        <Button
          variant={
            selectedTools.includes("search_grounding") ? "iconActive" : "icon"
          }
          icon={<Search className="h-4 w-4" />}
          onClick={toggleSearchGrounding}
          disabled={isDisabled}
          title={
            selectedTools.includes("search_grounding")
              ? "Disable search grounding"
              : "Enable search grounding"
          }
          aria-label={
            selectedTools.includes("search_grounding")
              ? "Disable search grounding"
              : "Enable search grounding"
          }
        />
      )}
    </div>
  );
};
