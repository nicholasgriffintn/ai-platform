import {
  Button,
  DialogTitle,
  EmptyState,
  OptionsMenu,
  OptionsMenuAction,
  cn,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useCharacterPresence,
  PET_SETTINGS_PATH,
  usePolyAgenda,
  useTrackEvent,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import {
  Ellipsis,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRight,
  PawPrint,
  PictureInPicture2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PolyAgendaStrip } from "./PolyAgendaStrip.js";
import { PolyFace } from "./PolyFace.js";
import { PolyFlock } from "./PolyFlock.js";
import { PolyMemoryView } from "./PolyMemoryView.js";
import { PolyRulesView } from "./PolyRulesView.js";
import { PolyThread } from "./PolyThread.js";

type PolyView = "chat" | "knows" | "rules";

export interface PolyPanelProps {
  layout: "dock" | "window";
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onClose: () => void;
}

export function PolyPanel({ layout, isExpanded, onToggleExpanded, onClose }: PolyPanelProps) {
  const navigate = useNavigate();
  const { trackEvent } = useTrackEvent();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const agenda = usePolyAgenda(isAuthenticated);
  const presence = useCharacterPresence({ conversationId: agenda.data?.conversation_id });
  const setPolyLayout = useUIStore((state) => state.setPolyLayout);
  const polySpeaks = useUIStore((state) => state.polySpeaks);
  const setPolySpeaks = useUIStore((state) => state.setPolySpeaks);
  const [view, setView] = useState<PolyView>("chat");
  const [showFlock, setShowFlock] = useState(false);
  const hideFlock = useCallback(() => setShowFlock(false), []);

  const handleNavigate = useCallback(
    (href: string) => {
      trackEvent({ name: "poly_navigate", category: "navigation", label: "poly", value: 1 });
      void navigate(href);
    },
    [navigate, trackEvent],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3 py-2",
          layout === "window" && "pr-14",
        )}
      >
        <PolyFace
          conversationId={agenda.data?.conversation_id}
          size={32}
          onFlock={() => setShowFlock(true)}
        />
        <div className="min-w-0 flex-1">
          {layout === "window" ? (
            <DialogTitle className="text-sm font-semibold">Poly</DialogTitle>
          ) : (
            <h2 className="m-0 text-sm leading-tight font-semibold">Poly</h2>
          )}
          <p className="truncate text-xs text-muted-foreground" aria-live="polite">
            {presence.status}
          </p>
        </div>
        <OptionsMenu
          align="end"
          trigger={
            <Button
              variant="icon"
              size="icon"
              className="shrink-0"
              aria-label="Poly options"
              title="Poly options"
            >
              <Ellipsis size={16} aria-hidden="true" />
            </Button>
          }
        >
          <OptionsMenuAction onSelect={() => setPolySpeaks(!polySpeaks)}>
            {polySpeaks ? (
              <VolumeX size={15} aria-hidden="true" />
            ) : (
              <Volume2 size={15} aria-hidden="true" />
            )}
            {polySpeaks ? "Stop reading replies aloud" : "Read replies aloud"}
          </OptionsMenuAction>
          <OptionsMenuAction onSelect={() => void navigate(PET_SETTINGS_PATH)}>
            <PawPrint size={15} aria-hidden="true" />
            Change your pet
          </OptionsMenuAction>
          {layout === "dock" ? (
            <OptionsMenuAction onSelect={() => setPolyLayout("window")}>
              <PictureInPicture2 size={15} aria-hidden="true" />
              Open in a window
            </OptionsMenuAction>
          ) : (
            <OptionsMenuAction onSelect={() => setPolyLayout("dock")}>
              <PanelRight size={15} aria-hidden="true" />
              Dock beside the page
            </OptionsMenuAction>
          )}
          {layout === "window" && onToggleExpanded ? (
            <OptionsMenuAction onSelect={onToggleExpanded}>
              {isExpanded ? (
                <Minimize2 size={15} aria-hidden="true" />
              ) : (
                <Maximize2 size={15} aria-hidden="true" />
              )}
              {isExpanded ? "Restore the window" : "Fill the screen"}
            </OptionsMenuAction>
          ) : null}
        </OptionsMenu>
        {layout === "dock" ? (
          <Button
            variant="icon"
            size="icon"
            className="shrink-0"
            aria-label="Close Poly"
            title="Close Poly"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {showFlock ? <PolyFlock onDone={hideFlock} /> : null}

      {!isAuthenticated ? (
        <div className="p-6">
          <SignInEmptyState
            title="Sign in to use Poly"
            message="Poly finds, opens and tidies your conversations, so it needs to know whose they are."
          />
        </div>
      ) : agenda.isError ? (
        <div className="p-6">
          <EmptyState
            title="Poly is not available right now"
            message="Its conversation could not be opened. Close this and try again in a moment."
          />
        </div>
      ) : !agenda.data ? (
        <output className="flex flex-1 items-center justify-center">
          <Loader2 size={20} aria-hidden="true" className="animate-spin text-muted-foreground" />
          <span className="sr-only">Opening Poly</span>
        </output>
      ) : (
        <>
          <Tabs
            value={view}
            onValueChange={(next) => setView(next === "knows" || next === "rules" ? next : "chat")}
            className="gap-0 border-b border-border px-3 py-1.5"
          >
            <TabsList className="h-8">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="knows">What Poly knows</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "chat" ? (
            <>
              <PolyAgendaStrip />
              <PolyThread
                key={agenda.data.conversation_id}
                conversationId={agenda.data.conversation_id}
                onNavigate={handleNavigate}
              />
            </>
          ) : view === "knows" ? (
            <PolyMemoryView contextId={agenda.data.context_id} />
          ) : (
            <PolyRulesView agenda={agenda.data} />
          )}
        </>
      )}
    </div>
  );
}
