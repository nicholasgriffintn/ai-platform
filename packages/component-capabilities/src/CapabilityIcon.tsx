import { cn, TeammateCharacter } from "@ngriffin_uk/polychat-component-ui";
import type {
  AssistantActionItem,
  CapabilityCatalogItem,
  ProjectCapabilityKind,
} from "@ngriffin_uk/polychat-schemas";
import { Bot, Puzzle, Sparkles, Wrench } from "lucide-react";

import { getIcon, getIconContainerClass } from "./capability-theme";

export function CapabilityIcon({
  app,
  item,
  kind,
  className,
}: {
  app?: CapabilityCatalogItem;
  item: AssistantActionItem;
  kind: ProjectCapabilityKind;
  className?: string;
}) {
  const appIcon = app ? getIcon(app.icon, app.theme) : null;

  return (
    <span
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl",
        app ? getIconContainerClass(app.theme) : "bg-surface-elevated",
        className,
      )}
    >
      {appIcon ? (
        appIcon
      ) : kind === "teammate" && item.metadata?.characterId ? (
        <TeammateCharacter
          characterId={item.metadata.characterId}
          teammateId={item.metadata.teammateId}
          name={item.label}
          size={36}
        />
      ) : kind === "tool" ? (
        <Wrench size={18} />
      ) : kind === "skill" ? (
        <Sparkles size={18} />
      ) : kind === "teammate" ? (
        <Bot size={18} />
      ) : (
        <Puzzle size={18} />
      )}
    </span>
  );
}
