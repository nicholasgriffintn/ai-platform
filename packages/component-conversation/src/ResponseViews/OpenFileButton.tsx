import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { PanelRightOpen } from "lucide-react";

export function OpenFileButton({
  toolName,
  outputId,
  onToolInteraction,
}: {
  toolName: string;
  outputId: string;
  onToolInteraction?: ToolInteractionHandler;
}) {
  if (!onToolInteraction) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<PanelRightOpen size={14} />}
      onClick={() => void onToolInteraction(toolName, "openFile", { outputId })}
    >
      Open
    </Button>
  );
}
