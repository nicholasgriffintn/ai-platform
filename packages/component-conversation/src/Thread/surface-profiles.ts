import type { ThreadModeConfig } from "./index.js";

export type ThreadSurface = "chat" | "project" | "poly" | "teammate" | "group" | "watch";

type SurfaceFlags = Pick<
  ThreadModeConfig,
  | "hideChatSettings"
  | "hideComposerActionMenu"
  | "hideComposerSuggestions"
  | "hideInlineResponseControls"
  | "hideModelSelector"
  | "hideSubmitButton"
  | "hideTextInput"
  | "hideVoiceControls"
  | "toolSelectionLocked"
>;

const THREAD_SURFACE_PROFILES: Record<ThreadSurface, SurfaceFlags> = {
  chat: {},
  project: {
    hideComposerSuggestions: true,
    toolSelectionLocked: true,
  },
  poly: {
    hideChatSettings: true,
    hideComposerActionMenu: true,
    hideComposerSuggestions: true,
    hideInlineResponseControls: true,
    hideModelSelector: true,
    toolSelectionLocked: true,
  },
  teammate: {
    hideChatSettings: true,
    hideComposerSuggestions: true,
    hideModelSelector: true,
    toolSelectionLocked: true,
  },
  group: {
    hideChatSettings: true,
    hideModelSelector: true,
    toolSelectionLocked: true,
  },
  watch: {
    hideChatSettings: true,
    hideComposerActionMenu: true,
    hideInlineResponseControls: true,
    hideModelSelector: true,
    hideSubmitButton: true,
    hideTextInput: true,
    hideVoiceControls: true,
    toolSelectionLocked: true,
  },
};

export function resolveThreadModeConfig(
  modeConfig: ThreadModeConfig | undefined,
): ThreadModeConfig | undefined {
  if (!modeConfig?.surface) {
    return modeConfig;
  }

  return { ...THREAD_SURFACE_PROFILES[modeConfig.surface], ...modeConfig };
}
