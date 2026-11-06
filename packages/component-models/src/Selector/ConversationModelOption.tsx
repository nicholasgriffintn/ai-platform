import { Checkbox, cn } from "@ngriffin_uk/polychat-component-ui";
import { getModelDisplayName } from "@ngriffin_uk/polychat-schemas";
import type { ModelCatalogItem } from "@ngriffin_uk/polychat-schemas";

import { ModelIcon } from "../ModelIcon/ModelIcon";

interface ConversationModelOptionProps {
  model: ModelCatalogItem;
  onSelect: (modelId: string) => void;
  isDisabled?: boolean;
  isSelected?: boolean;
  showCheckbox?: boolean;
}

export function ConversationModelOption({
  model,
  onSelect,
  isDisabled = false,
  isSelected = false,
  showCheckbox = false,
}: ConversationModelOptionProps) {
  const displayName = getModelDisplayName(model);

  const handleSelect = () => {
    if (!isDisabled) {
      onSelect(model.id);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2 py-2 transition-colors",
        isSelected ? "bg-active-work/12 text-active-work" : "hover:bg-surface-elevated",
        isDisabled && "opacity-45 hover:bg-transparent",
      )}
    >
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          disabled={isDisabled}
          className="mt-0.5"
          tabIndex={-1}
          aria-hidden
          onCheckedChange={handleSelect}
        />
      )}
      <button
        type="button"
        disabled={isDisabled}
        aria-pressed={showCheckbox ? isSelected : undefined}
        onClick={handleSelect}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-md text-left",
          isDisabled && "cursor-not-allowed",
        )}
      >
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
          <ModelIcon
            modelName={displayName}
            provider={model.provider}
            url={model.avatarUrl}
            size={18}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-5 font-medium break-words whitespace-normal text-foreground">
            {displayName}
          </span>
          <span className="block text-xs leading-4 break-words whitespace-normal text-muted-foreground">
            {model.provider}
          </span>
        </span>
      </button>
    </div>
  );
}
