export * from "./AppInitializer";
export * from "./state/stores/petStore";
export * from "./hooks/use-analytics-identity";
export * from "./hooks/use-openfeature";
export * from "./hooks/use-posthog-client";
export * from "./hooks/use-track-event";
export * from "./hooks/useActivity";
export * from "./hooks/useApiKeys";
export * from "./hooks/useArticles";
export * from "./hooks/useArtifactPanel";
export * from "./hooks/useAssistantActionCatalog";
export * from "./hooks/useAuth";
export * from "./hooks/useBilling";
export * from "./hooks/useDesktopDownloads";
export * from "./hooks/useCanAccessProFeatures";
export * from "./hooks/useCanvas";
export * from "./hooks/useCapabilityCatalog";
export * from "./hooks/useChatSuggestionContext";
export * from "./hooks/useComposerPrefill";
export * from "./hooks/useConnectorSetup";
export * from "./hooks/useConnectors";
export * from "./hooks/useConversationModelOptions";
export * from "./hooks/useConversationOrganisation";
export * from "./hooks/useConversationRoute";
export * from "./hooks/useCopyToClipboard";
export * from "./hooks/useDeferredPetPreview";
export * from "./hooks/useDrawings";
export * from "./hooks/useFileUploadAnalytics";
export * from "./hooks/useGovernance";
export * from "./hooks/useIsHydrated";
export * from "./hooks/useKeyboardShortcuts";
export * from "./hooks/useMemoryDocuments";
export * from "./hooks/useModelTools";
export * from "./hooks/useNoteFormatter";
export * from "./hooks/useNotes";
export * from "./hooks/useOutputs";
export * from "./hooks/usePasskeys";
export * from "./hooks/usePetNudgeSources";
export * from "./hooks/usePetPresence";
export * from "./hooks/usePetShowreel";
export * from "./hooks/usePetSwapTransition";
export * from "./hooks/usePetTravel";
export * from "./hooks/usePets";
export * from "./hooks/useProjectCapabilityCatalog";
export * from "./hooks/useProjectConversationSources";
export * from "./hooks/useProjectTasks";
export * from "./hooks/useProjectWorkbenchControls";
export * from "./hooks/useProjectWorkbenchEvidence";
export * from "./hooks/useProjectWorkbenchPreferences";
export * from "./hooks/useProjectWorkbenchPreview";
export * from "./hooks/useProjectWorkbenchRuns";
export * from "./hooks/useRealtimeLiveSession";
export * from "./hooks/useRealtimeProviders";
export * from "./hooks/useRecipes";
export * from "./hooks/useRecordings";
export * from "./hooks/useReplicate";
export * from "./hooks/useResearchStatus";
export * from "./hooks/useResponsiveSidebar";
export * from "./hooks/useRunnableTools";
export * from "./hooks/useSandbox";
export * from "./hooks/useSavedMessages";
export * from "./hooks/useSharedTeammates";
export * from "./hooks/useSkills";
export * from "./hooks/useSources";
export * from "./hooks/useStartNewChat";
export * from "./hooks/useStrudel";
export * from "./hooks/useTabAudioCapture";
export * from "./hooks/useTaskInbox";
export * from "./hooks/useTaskNotifications";
export * from "./hooks/useTasks";
export * from "./hooks/useTeammateFilters";
export * from "./hooks/useTeammateToolDefaults";
export * from "./hooks/useTeammates";
export * from "./hooks/useTheme";
export * from "./hooks/useToolConfigurations";
export * from "./hooks/useTools";
export * from "./hooks/useTraining";
export * from "./hooks/useTranscription";
export * from "./hooks/useUser";
export * from "./hooks/useVoiceRecorder";
export * from "./hooks/useWorkAttention";
export * from "./hooks/useWorkspaces";
export * from "./lib/analytics/client";
export * from "./lib/analytics-adapter";
export * from "./lib/assistant-action-execution";
export * from "./lib/assistant-action-flow";
export * from "./lib/assistant-action-launch";
export * from "./lib/auth/login-error";
export * from "./lib/capability-surfaces";
export * from "./lib/chat-suggestions/catalog";
export * from "./lib/chat-suggestions/index";
export * from "./lib/chat-suggestions/types";
export * from "./lib/chat-welcome";
export * from "./lib/chatModes";
export * from "./lib/composer-prefill";
export * from "./lib/connector-auth-popup";
export * from "./lib/conversation-organisation";
export * from "./lib/conversation-route";
export * from "./lib/conversation-sections";
export * from "./lib/crypto/nonce";
export * from "./lib/crypto/sha256";
export * from "./lib/dom/customEvent";
export * from "./lib/dom/loadExternalScript";
export * from "./lib/external-navigation";
export * from "./lib/files-route";
export * from "./lib/focus-role";
export * from "./lib/global-search";
export * from "./lib/home-chat-modes/conversation-mode";
export * from "./lib/keyboard-shortcuts";
export * from "./lib/memories/presentation";
export * from "./lib/meta-assistant";
export * from "./lib/model-catalogue";
export * from "./lib/model-lineup-view";
export * from "./lib/model-providers";
export * from "./lib/navigation/places";
export * from "./lib/notifications/web-push";
export * from "./lib/pet/clip";
export * from "./lib/pet/compose-sheet";
export * from "./lib/pet/lore";
export * from "./lib/pet/model-targets";
export * from "./lib/plan-format";
export * from "./lib/profile-tabs";
export * from "./lib/project-capability-catalog";
export * from "./lib/project-coding-presentation";
export * from "./lib/project-workbench-preview";
export * from "./lib/project-workbench";
export * from "./lib/realtime/live-session-controller";
export * from "./lib/realtime/live-websocket-connection";
export * from "./lib/realtime/live-websocket-resumption";
export * from "./lib/router-link";
export * from "./lib/sandbox/prompt-strategies";
export * from "./lib/sandbox/sse";
export * from "./lib/security-headers";
export * from "./lib/sidebar-usage";
export * from "./lib/sidebar";
export * from "./lib/sources/attachments";
export * from "./lib/sources/project-context";
export * from "./lib/surface-controls-context";
export * from "./lib/surface-context";
export * from "./lib/surface-controls";
export * from "./lib/teammates/teammate-permissions";
export * from "./lib/utils";
export * from "./lib/work/invitation-token";
export * from "./lib/work/project-route-scope";
export * from "./lib/work-attention";
export * from "./state/stores/petStore";
export * from "./state/stores/themeStore";
export * from "./state/stores/uiStore";
export * from "./chat/useWebLLMInitialization";
export * from "./chat/useWebLLMModels";
export * from "./chat/web-llm-models";
export * from "./chat/web-llm";
export * from "./local/useIndexedDB";
export * from "./chat/conversation-polling";
export * from "./chat/live-turn-messages";
export * from "./chat/model-readiness";
export * from "./chat/pending-conversation";
export * from "./chat/prepare-user-message";
export * from "./chat/retry-composer";
export * from "./chat/run-command";
export * from "./chat/run-presentation";
export * from "./chat/stream-progress-coalescer";
export * from "./chat/stream-state";
export * from "./chat/title-source";
export * from "./chat/transcript-text";
export * from "./chat/usage-ledger";
export * from "./chat/usage-limits";
export * from "./chat/useChat";
export * from "./chat/useChatManager";
export * from "./chat/useChatRunReplay";
export * from "./chat/useConversationActions";
export * from "./chat/useConversationStorage";
export * from "./chat/useGoal";
export * from "./chat/useLiveConversationMessages";
export * from "./chat/useMessageOperations";
export * from "./chat/useModels";
export * from "./chat/useRemoteConversationActivity";
export * from "./chat/useStreamingResponse";
export * from "./chat/useUsage";
export * from "./state/usageStore";
export * from "./state/LoadingContext";
export * from "./state/composer-draft";
export * from "./state/conversation-scope";
export * from "./errors";
export * from "./local/indexeddb-conversation-store";
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
