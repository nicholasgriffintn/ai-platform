import { Button, OptionsMenu, OptionsMenuAction } from "@ngriffin_uk/polychat-component-ui";
import { Plus } from "lucide-react";

import type { CapabilityAddChoice } from "~/components/Capabilities/useCapabilityAuthoring";

export function CapabilityAddMenu({ choices }: { choices: CapabilityAddChoice[] }) {
  if (choices.length === 0) {
    return null;
  }

  return (
    <OptionsMenu
      align="end"
      className="min-w-64"
      trigger={
        <Button
          type="button"
          variant="primary"
          size="sm"
          collapseLabel
          icon={<Plus className="h-4 w-4" />}
          aria-label="Add to this library"
          title="Add to this library"
        >
          Add
        </Button>
      }
    >
      {choices.map((choice) => (
        <OptionsMenuAction key={choice.label} onSelect={choice.onSelect} className="items-start">
          <span className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400">{choice.icon}</span>
          <span className="ml-2 flex min-w-0 flex-col gap-0.5 text-left">
            <span className="font-medium text-zinc-800 dark:text-zinc-100">{choice.label}</span>
            <span className="text-zinc-500 dark:text-zinc-400">{choice.description}</span>
          </span>
        </OptionsMenuAction>
      ))}
    </OptionsMenu>
  );
}
