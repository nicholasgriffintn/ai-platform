export type AppKeyboardShortcutId =
  | "search"
  | "new-chat"
  | "toggle-sidebar"
  | "toggle-keyboard-shortcuts"
  | "toggle-meta-assistant"
  | "open-model-selector"
  | "cycle-compute-site"
  | "toggle-retention"
  | "dictate"
  | "live";

export type ModelSelectorShortcut = "open" | "cycle-compute-site" | "toggle-retention";

export const MODEL_SELECTOR_SHORTCUT_EVENT = "polychat:model-selector-shortcut";

interface ShortcutMatch {
  key: string;
  modifier: "control" | "primary";
  shift?: boolean;
}

export interface AppKeyboardShortcut {
  id: string;
  description: string;
  keys: string[];
  match?: ShortcutMatch;
}

export interface AppKeyboardShortcutSection {
  title: string;
  shortcuts: AppKeyboardShortcut[];
}

const actionableShortcuts: Record<AppKeyboardShortcutId, AppKeyboardShortcut> = {
  search: {
    id: "search",
    description: "Search",
    keys: ["⌘/Ctrl", "K"],
    match: { key: "k", modifier: "primary" },
  },
  "new-chat": {
    id: "new-chat",
    description: "New chat",
    keys: ["⌘/Ctrl", "⇧", "O"],
    match: { key: "o", modifier: "primary", shift: true },
  },
  "toggle-sidebar": {
    id: "toggle-sidebar",
    description: "Toggle sidebar",
    keys: ["⌘/Ctrl", "B"],
    match: { key: "b", modifier: "primary" },
  },
  "toggle-keyboard-shortcuts": {
    id: "toggle-keyboard-shortcuts",
    description: "Keyboard shortcuts",
    keys: ["⌘/Ctrl", "⇧", "/"],
    match: { key: "/", modifier: "primary", shift: true },
  },
  "toggle-meta-assistant": {
    id: "toggle-meta-assistant",
    description: "Ask Poly",
    keys: ["⌘/Ctrl", "J"],
    match: { key: "j", modifier: "primary" },
  },
  "open-model-selector": {
    id: "open-model-selector",
    description: "Open model selector",
    keys: ["⌘/Ctrl", "/"],
    match: { key: "/", modifier: "primary" },
  },
  "cycle-compute-site": {
    id: "cycle-compute-site",
    description: "Cycle compute site",
    keys: ["⌘/Ctrl", "⇧", "L"],
    match: { key: "l", modifier: "primary", shift: true },
  },
  "toggle-retention": {
    id: "toggle-retention",
    description: "Toggle chat retention",
    keys: ["⌘/Ctrl", "⇧", "T"],
    match: { key: "t", modifier: "primary", shift: true },
  },
  dictate: {
    id: "dictate",
    description: "Start or stop dictating",
    keys: ["⌃", "⇧", "D"],
    match: { key: "d", modifier: "control", shift: true },
  },
  live: {
    id: "live",
    description: "Enter or exit Live",
    keys: ["⌃", "⇧", "V"],
    match: { key: "v", modifier: "control", shift: true },
  },
};

export const APP_KEYBOARD_SHORTCUT_SECTIONS: AppKeyboardShortcutSection[] = [
  {
    title: "Composer",
    shortcuts: [
      actionableShortcuts.dictate,
      actionableShortcuts.live,
      { id: "send", description: "Send message", keys: ["Enter"] },
      { id: "new-line", description: "Insert new line", keys: ["⇧", "Enter"] },
      { id: "open-actions", description: "Show actions", keys: ["/"] },
      {
        id: "mention-capability",
        description: "Show recipes, agents, connectors, and tools",
        keys: ["@"],
      },
      { id: "select-model", description: "Filter model actions", keys: ["/model"] },
      {
        id: "select-reasoning",
        description: "Filter reasoning depth actions",
        keys: ["/reasoning"],
      },
      {
        id: "select-verbosity",
        description: "Filter verbosity actions",
        keys: ["/verbosity"],
      },
      { id: "open-settings", description: "Filter settings actions", keys: ["/settings"] },
      { id: "open-tools", description: "Filter tool actions", keys: ["/tools"] },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      actionableShortcuts.search,
      actionableShortcuts["new-chat"],
      actionableShortcuts["toggle-sidebar"],
      actionableShortcuts["toggle-meta-assistant"],
      actionableShortcuts["open-model-selector"],
      actionableShortcuts["cycle-compute-site"],
      actionableShortcuts["toggle-retention"],
      actionableShortcuts["toggle-keyboard-shortcuts"],
      { id: "close", description: "Close panels or stop generation", keys: ["Esc"] },
    ],
  },
];

export function getModelSelectorShortcut(event: Event): ModelSelectorShortcut | undefined {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }

  switch (event.detail) {
    case "open":
    case "cycle-compute-site":
    case "toggle-retention":
      return event.detail;
    default:
      return undefined;
  }
}

export function dispatchModelSelectorShortcut(shortcut: ModelSelectorShortcut): void {
  window.dispatchEvent(
    new CustomEvent<ModelSelectorShortcut>(MODEL_SELECTOR_SHORTCUT_EVENT, {
      detail: shortcut,
    }),
  );
}

export function matchesAppKeyboardShortcut(
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
  id: AppKeyboardShortcutId,
): boolean {
  const shortcut = actionableShortcuts[id].match;

  if (!shortcut || event.altKey || event.key.toLowerCase() !== shortcut.key) {
    return false;
  }

  const modifierMatches =
    shortcut.modifier === "control"
      ? event.ctrlKey && !event.metaKey
      : event.metaKey || event.ctrlKey;

  return modifierMatches && event.shiftKey === Boolean(shortcut.shift);
}
