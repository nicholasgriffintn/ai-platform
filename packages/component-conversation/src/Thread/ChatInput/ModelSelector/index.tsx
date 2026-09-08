import { useModelSelection, type ModelSelectionOptions } from "@ngriffin_uk/polychat-library-react";
import type { ModelSelectorScope } from "@ngriffin_uk/polychat-schemas";
import { Loader2 } from "lucide-react";

import { ModelSelectorView } from "./ModelSelectorView.js";
import { useModelSelectorController } from "./useModelSelectorController.js";

interface ModelSelectorProps extends Pick<
  ModelSelectionOptions,
  "featuredOnly" | "modelProviderFilter" | "onBeforeModelChange" | "onModelChange"
> {
  isDisabled?: boolean;
  minimal?: boolean;
  mono?: boolean;
  modelScope?: ModelSelectorScope;
}

export const ModelSelector = ({
  isDisabled,
  minimal = false,
  mono = false,
  modelScope = "default",
  ...selectionOptions
}: ModelSelectorProps) => {
  const selection = useModelSelection({ ...selectionOptions, modelScope });
  const controller = useModelSelectorController({
    isOpen: selection.isOpen && !selection.isLoading,
    onOpen: selection.openSelector,
    onClose: selection.closeSelector,
  });

  if (selection.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  return (
    <ModelSelectorView
      controller={controller}
      isDisabled={isDisabled}
      minimal={minimal}
      mono={mono}
      selection={selection}
    />
  );
};
