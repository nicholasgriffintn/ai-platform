import type { AssistantActionItem, AssistantActionItemKind } from "@ngriffin_uk/polychat-schemas";
import { Bot, BookOpen, Plug, ScrollText, Wrench } from "lucide-react";

export const ASSISTANT_ACTION_ITEM_GROUPS: Array<{
  kinds: AssistantActionItemKind[];
  label: string;
  emptyLabel: string;
  icon: typeof Bot;
}> = [
  {
    kinds: ["installed_recipe", "recipe"],
    label: "Recipes",
    emptyLabel: "recipes",
    icon: ScrollText,
  },
  { kinds: ["skill"], label: "Skills", emptyLabel: "skills", icon: BookOpen },
  { kinds: ["agent"], label: "Agents", emptyLabel: "agents", icon: Bot },
  { kinds: ["connector"], label: "Connectors", emptyLabel: "connectors", icon: Plug },
  { kinds: ["tool"], label: "Tools", emptyLabel: "tools", icon: Wrench },
];

export const ASSISTANT_ACTION_ITEM_SCOPE_LABEL = "Recipes, skills, agents, connectors, and tools";
export const ASSISTANT_ACTION_ITEM_EMPTY_LABEL = "recipes, skills, agents, connectors, or tools";

export function groupAssistantActionItems(items: AssistantActionItem[]) {
  return ASSISTANT_ACTION_ITEM_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => group.kinds.includes(item.kind)),
  })).filter((group) => group.items.length > 0);
}

export function describeAssistantActionItem(item: AssistantActionItem): string {
  if (item.description) {
    return item.description;
  }

  if (item.status) {
    return item.status;
  }

  if (item.kind === "installed_recipe" || item.kind === "recipe") {
    return "Use this recipe";
  }

  return `Use this ${item.kind}`;
}

export function AssistantActionItemIcon({ item }: { item: AssistantActionItem }) {
  const group = ASSISTANT_ACTION_ITEM_GROUPS.find((candidate) =>
    candidate.kinds.includes(item.kind),
  );
  const Icon = group?.icon ?? Wrench;

  return <Icon className="h-4 w-4" aria-hidden="true" />;
}
