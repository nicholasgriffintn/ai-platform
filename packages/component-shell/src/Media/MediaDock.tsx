import { Button, cn, MediaTransport, mediaPosition } from "@ngriffin_uk/polychat-component-ui";
import {
  useMediaLoudness,
  useMediaTrack,
  type MediaTrack,
} from "@ngriffin_uk/polychat-utility-react";
import { AudioLines, Maximize2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

export interface MediaDockItem {
  id: string;
  src: string;
  title: string;
  subtitle?: string;
  artBackground?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  levelVoice?: boolean;
  href: string;
}

export interface MediaDockValue {
  item: MediaDockItem | null;
  track: MediaTrack;
  load: (item: MediaDockItem) => void;
  clear: () => void;
  present: (id: string) => () => void;
}

const MediaDockContext = createContext<MediaDockValue | null>(null);

export function useMediaDock(): MediaDockValue | null {
  return useContext(MediaDockContext);
}

function MediaDockAudio({ item, track }: { item: MediaDockItem; track: MediaTrack }) {
  const attachAudio = useMediaLoudness(track.attach, item.levelVoice ?? false);

  return (
    <audio
      ref={attachAudio}
      src={item.src}
      title={item.title}
      preload="metadata"
      crossOrigin={item.crossOrigin}
    />
  );
}

function MediaDockBar({
  item,
  track,
  onClear,
}: {
  item: MediaDockItem;
  track: MediaTrack;
  onClear: () => void;
}) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const atHref = `${pathname}${search}` === item.href;

  return (
    <div
      role="region"
      aria-label="Now playing"
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-surface-elevated/95 p-2 pl-3 shadow-lg backdrop-blur",
        "md:inset-x-auto md:right-4 md:left-1/2 md:w-[min(36rem,calc(100vw-2rem))] md:-translate-x-1/2",
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: item.artBackground ?? "var(--color-selection)" }}
      >
        <AudioLines size={16} className={cn(track.playing && "animate-pulse")} />
      </span>
      <div className="min-w-0 flex-1">
        <MediaTransport
          playing={track.playing}
          busy={track.buffering}
          onToggle={track.toggle}
          caption={
            <span className="block truncate text-xs text-muted-foreground">
              {item.subtitle ? `${item.subtitle} · ` : null}
              <span className="font-medium text-foreground">{item.title}</span>
            </span>
          }
          {...mediaPosition(track)}
        />
      </div>
      {!atHref && (
        <Button
          variant="icon"
          size="icon"
          aria-label="Open the player"
          onClick={() => void navigate(item.href)}
        >
          <Maximize2 size={15} aria-hidden />
        </Button>
      )}
      <Button variant="icon" size="icon" aria-label="Stop and close" onClick={onClear}>
        <X size={15} aria-hidden />
      </Button>
    </div>
  );
}

export function MediaDockProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<MediaDockItem | null>(null);
  const [presentedId, setPresentedId] = useState<string | null>(null);
  const track = useMediaTrack();
  const load = useCallback((next: MediaDockItem) => {
    setItem((current) => (current?.id === next.id && current.src === next.src ? current : next));
  }, []);
  const pause = track.pause;
  const clear = useCallback(() => {
    pause();
    setItem(null);
  }, [pause]);
  const present = useCallback((id: string) => {
    setPresentedId(id);

    return () => setPresentedId((current) => (current === id ? null : current));
  }, []);
  const value = useMemo<MediaDockValue>(
    () => ({ item, track, load, clear, present }),
    [clear, item, load, present, track],
  );

  return (
    <MediaDockContext.Provider value={value}>
      {children}
      {item ? <MediaDockAudio key={item.id} item={item} track={track} /> : null}
      {item && presentedId !== item.id ? (
        <MediaDockBar item={item} track={track} onClear={clear} />
      ) : null}
    </MediaDockContext.Provider>
  );
}
