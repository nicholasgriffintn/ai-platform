export * from "./AppInitializer.js";
export * from "./state/stores/petStore.js";
export * from "./hooks/use-analytics-identity.js";
export * from "./hooks/use-openfeature.js";
export * from "./hooks/use-posthog-client.js";
export * from "./hooks/use-track-event.js";
export * from "./hooks/useActivity.js";
export * from "./hooks/useApiKeys.js";
export * from "./hooks/useArticles.js";
export * from "./hooks/useArtifactPanel.js";
export * from "./hooks/useAssistantActionCatalog.js";
export * from "./hooks/useAuth.js";
export * from "./hooks/useBilling.js";
export * from "./hooks/useDesktopDownloads.js";
export * from "./hooks/useCanAccessProFeatures.js";
export * from "./hooks/useCanvas.js";
export * from "./hooks/useCapabilityCatalog.js";
export * from "./hooks/useChatSuggestionContext.js";
export * from "./hooks/useComposerPrefill.js";
export * from "./hooks/useConnectorSetup.js";
export * from "./hooks/useConnectors.js";
export * from "./hooks/useConversationModelOptions.js";
export * from "./hooks/useConversationOrganisation.js";
export * from "./hooks/useConversationRoute.js";
export * from "./hooks/useCopyToClipboard.js";
export * from "./hooks/useDeferredPetPreview.js";
export * from "./hooks/useDrawings.js";
export * from "./hooks/useDelegations.js";
export * from "./hooks/useFileUploadAnalytics.js";
export * from "./hooks/useGovernance.js";
export * from "./hooks/useIsHydrated.js";
export * from "./hooks/useKeyboardShortcuts.js";
export * from "./hooks/useMemoryDocuments.js";
export * from "./hooks/useModelTools.js";
export * from "./hooks/useNoteFormatter.js";
export * from "./hooks/useNotes.js";
export * from "./hooks/useOutputs.js";
export * from "./hooks/usePasskeys.js";
export * from "./hooks/usePetNudgeSources.js";
export * from "./hooks/usePetPresence.js";
export * from "./hooks/usePetShowreel.js";
export * from "./hooks/usePetSwapTransition.js";
export * from "./hooks/usePetTravel.js";
export * from "./hooks/usePets.js";
export * from "./hooks/useProjectCapabilityCatalog.js";
export * from "./hooks/useProjectConversationSources.js";
export * from "./hooks/useProjectTasks.js";
export * from "./hooks/useProjectWorkbenchControls.js";
export * from "./hooks/useProjectWorkbenchEvidence.js";
export * from "./hooks/useProjectWorkbenchPreferences.js";
export * from "./hooks/useProjectWorkbenchPreview.js";
export * from "./hooks/useProjectWorkbenchRuns.js";
export * from "./hooks/useRealtimeLiveSession.js";
export * from "./hooks/useRealtimeProviders.js";
export * from "./hooks/useRecipes.js";
export * from "./hooks/useRecordings.js";
export * from "./hooks/useReplicate.js";
export * from "./hooks/useResearchStatus.js";
export * from "./hooks/useResponsiveSidebar.js";
export * from "./hooks/useRunnableTools.js";
export * from "./hooks/useSandbox.js";
export * from "./hooks/useSavedMessages.js";
export * from "./hooks/useSharedTeammates.js";
export * from "./hooks/useSkills.js";
export * from "./hooks/useSources.js";
export * from "./hooks/useStartNewChat.js";
export * from "./hooks/useStrudel.js";
export * from "./hooks/useTabAudioCapture.js";
export * from "./hooks/useTaskNotifications.js";
export * from "./hooks/useTasks.js";
export * from "./hooks/useTeammateFilters.js";
export * from "./hooks/useTeammateToolDefaults.js";
export * from "./hooks/useTeammates.js";
export * from "./hooks/useTheme.js";
export * from "./hooks/useToolConfigurations.js";
export * from "./hooks/useTools.js";
export * from "./hooks/useTraining.js";
export * from "./hooks/useTranscription.js";
export * from "./hooks/useUser.js";
export * from "./hooks/useVoiceRecorder.js";
export * from "./hooks/useWorkAttention.js";
export * from "./hooks/useWorkspaces.js";
export * from "./lib/analytics/client.js";
export * from "./lib/analytics-adapter.js";
export * from "./lib/assistant-action-execution.js";
export * from "./lib/assistant-action-flow.js";
export * from "./lib/assistant-action-launch.js";
export * from "./lib/auth/login-error.js";
export * from "./lib/capability-surfaces.js";
export * from "./lib/chat-suggestions/catalog.js";
export * from "./lib/chat-suggestions/index.js";
export * from "./lib/chat-suggestions/types.js";
export * from "./lib/chat-welcome.js";
export * from "./lib/chatModes.js";
export * from "./lib/composer-prefill.js";
export * from "./lib/connector-auth-popup.js";
export * from "./lib/conversation-organisation.js";
export * from "./lib/conversation-route.js";
export * from "./lib/conversation-sections.js";
export * from "./lib/crypto/nonce.js";
export * from "./lib/crypto/sha256.js";
export * from "./lib/dom/customEvent.js";
export * from "./lib/dom/loadExternalScript.js";
export * from "./lib/external-navigation.js";
export * from "./lib/files-route.js";
export * from "./lib/focus-role.js";
export * from "./lib/global-search.js";
export * from "./lib/home-chat-modes/conversation-mode.js";
export * from "./lib/keyboard-shortcuts.js";
export * from "./lib/memories/presentation.js";
export * from "./lib/meta-assistant.js";
export * from "./lib/model-catalogue.js";
export * from "./lib/model-lineup-view.js";
export * from "./lib/model-sources.js";
export * from "./lib/model-providers.js";
export * from "./lib/navigation/places.js";
export * from "./lib/notifications/web-push.js";
export * from "./sync/bindings.js";
export * from "./sync/live-or-poll.js";
export * from "./sync/useDeviceSync.js";
export * from "./lib/pet/clip.js";
export * from "./lib/pet/compose-sheet.js";
export * from "./lib/pet/lore.js";
export * from "./lib/pet/model-targets.js";
export * from "./lib/plan-format.js";
export * from "./lib/profile-tabs.js";
export * from "./lib/project-capability-catalog.js";
export * from "./lib/project-coding-presentation.js";
export * from "./lib/project-workbench-preview.js";
export * from "./lib/project-workbench.js";
export * from "./lib/realtime/live-session-controller.js";
export * from "./lib/realtime/live-websocket-connection.js";
export * from "./lib/realtime/live-websocket-resumption.js";
export * from "./lib/router-link.js";
export * from "./lib/sandbox/prompt-strategies.js";
export * from "./lib/sandbox/sse.js";
export * from "./lib/security-headers.js";
export * from "./lib/sidebar-usage.js";
export * from "./lib/sidebar.js";
export * from "./lib/sources/attachments.js";
export * from "./lib/sources/project-context.js";
export * from "./lib/surface-controls-context.js";
export * from "./lib/surface-context.js";
export * from "./lib/surface-controls.js";
export * from "./lib/teammates/teammate-permissions.js";
export * from "./lib/utils.js";
export * from "./lib/work/invitation-token.js";
export * from "./lib/work/project-route-scope.js";
export * from "./lib/work-attention.js";
export * from "./state/stores/petStore.js";
export * from "./state/stores/themeStore.js";
export * from "./state/stores/uiStore.js";
export * from "./chat/useWebLLMInitialization.js";
export * from "./chat/useWebLLMModels.js";
export * from "./chat/web-llm-models.js";
export * from "./chat/web-llm.js";
export * from "./local/useIndexedDB.js";
export * from "./chat/conversation-polling.js";
export * from "./chat/live-turn-messages.js";
export * from "./chat/model-readiness.js";
export * from "./chat/pending-conversation.js";
export * from "./chat/prepare-user-message.js";
export * from "./chat/retry-composer.js";
export * from "./chat/run-command.js";
export * from "./chat/run-presentation.js";
export * from "./chat/stream-progress-coalescer.js";
export * from "./chat/stream-state.js";
export * from "./chat/title-source.js";
export * from "./chat/transcript-text.js";
export * from "./chat/usage-ledger.js";
export * from "./chat/usage-limits.js";
export * from "./chat/useChat.js";
export * from "./chat/useChatManager.js";
export * from "./chat/useChatRunReplay.js";
export * from "./chat/useConversationActions.js";
export * from "./chat/useConversationRetention.js";
export * from "./chat/useConversationStorage.js";
export * from "./chat/useDeviceModels.js";
export * from "./chat/useMachines.js";
export * from "./chat/useGoal.js";
export * from "./chat/useLiveConversationMessages.js";
export * from "./chat/useMessageOperations.js";
export * from "./chat/useModels.js";
export * from "./chat/useModelTiers.js";
export * from "./chat/useModelRuntimeOptions.js";
export * from "./chat/useModelSelection.js";
export * from "./chat/useRuntimeEndpoints.js";
export * from "./chat/useRemoteConversationActivity.js";
export * from "./chat/useStreamingResponse.js";
export * from "./chat/useUsage.js";
export * from "./state/usageStore.js";
export * from "./state/LoadingContext.js";
export * from "./state/composer-draft.js";
export * from "./state/conversation-scope.js";
export * from "./errors.js";
export * from "./local/indexeddb-conversation-store.js";
import { shouldRetryApiQuery } from "@ngriffin_uk/polychat-library-client/retry";
import { noopSurfaceAnalytics, type SurfaceAnalytics } from "@ngriffin_uk/polychat-library-surface";
import { QueryClient, QueryClientProvider, type QueryClientConfig } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

export interface PolychatProviderProps {
  children: ReactNode;
  queryClient?: QueryClient;
  queryClientConfig?: QueryClientConfig;
}

export function createPolychatQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: shouldRetryApiQuery,
        ...config.defaultOptions?.queries,
      },
    },
  });
}

export function PolychatProvider({
  children,
  queryClient,
  queryClientConfig,
}: PolychatProviderProps) {
  const [client] = useState(() => queryClient ?? createPolychatQueryClient(queryClientConfig));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const AnalyticsContext = createContext<SurfaceAnalytics>(noopSurfaceAnalytics);

export interface AnalyticsProviderProps {
  analytics: SurfaceAnalytics;
  children: ReactNode;
}

export function AnalyticsProvider({ analytics, children }: AnalyticsProviderProps) {
  return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>;
}

/** Render packages report through this; without a provider the events are dropped. */
export function useAnalytics(): SurfaceAnalytics {
  return useContext(AnalyticsContext);
}
