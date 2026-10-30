import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  useMediaLoudness,
  useMediaTrack,
  type MediaTrack,
} from "@ngriffin_uk/polychat-utility-react";
import { AudioLines, LoaderCircle, Pause, Play, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

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
  presented: boolean;
  load: (item: MediaDockItem) => void;
  clear: () => void;
  present: (id: string) => () => void;
}

const MediaDockContext = createContext<MediaDockValue | null>(null);

export function useMediaDock(): MediaDockValue | null {
  return useContext(MediaDockContext);
}

function useRemoteMedia() {
  const dock = useMediaDock();

  if (!dock?.item || dock.presented) {
    return null;
  }

  return { item: dock.item, track: dock.track, clear: dock.clear };
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

function PlaybackIcon({ track, size }: { track: MediaTrack; size: number }) {
  if (track.buffering) {
    return <LoaderCircle size={size} className="animate-spin" aria-hidden />;
  }

  return track.playing ? (
    <Pause size={size} fill="currentColor" aria-hidden />
  ) : (
    <Play size={size} fill="currentColor" className="translate-x-px" aria-hidden />
  );
}

function artStyle(item: MediaDockItem) {
  return { background: item.artBackground ?? "var(--color-selection)" };
}

export function MediaDockSidebarRow({ onOpen }: { onOpen?: () => void }) {
  const remote = useRemoteMedia();
  const navigate = useNavigate();

  if (!remote) {
    return null;
  }

  const { item, track, clear } = remote;
  const progress =
    track.duration > 0 ? Math.min(100, (track.currentTime / track.duration) * 100) : 0;

  return (
    <section
      aria-label="Now playing"
      className="relative flex items-center gap-1 border-b border-sidebar-border py-2 pr-2 pl-3"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-sidebar-border">
        <div
          className="h-full bg-foreground/60 transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        type="button"
        title="Open the player"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        onClick={() => {
          onOpen?.();
          void navigate(item.href);
        }}
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
          style={artStyle(item)}
        >
          <AudioLines size={14} className={cn(track.playing && "animate-pulse")} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {item.subtitle ? (
            <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
          ) : null}
        </span>
      </button>
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label={track.playing ? "Pause" : "Play"}
        onClick={track.toggle}
        icon={<PlaybackIcon track={track} size={14} />}
      />
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label="Stop and close"
        onClick={clear}
        icon={<X size={14} aria-hidden />}
      />
    </section>
  );
}

export function MediaDockHeaderChip() {
  const remote = useRemoteMedia();
  const navigate = useNavigate();

  if (!remote) {
    return null;
  }

  const { item, track, clear } = remote;

  return (
    <section
      aria-label="Now playing"
      className="flex h-8 min-w-0 shrink items-center rounded-full @min-[40rem]:border @min-[40rem]:border-border @min-[40rem]:bg-surface-elevated @min-[40rem]:p-0.5"
    >
      <button
        type="button"
        aria-label={track.playing ? `Pause ${item.title}` : `Play ${item.title}`}
        onClick={track.toggle}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
        style={artStyle(item)}
      >
        <PlaybackIcon track={track} size={12} />
      </button>
      <button
        type="button"
        title="Open the player"
        onClick={() => void navigate(item.href)}
        className="hidden max-w-48 min-w-0 truncate rounded-full px-2 text-xs font-medium text-foreground hover:text-active-work focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none @min-[40rem]:block"
      >
        {item.title}
      </button>
      <button
        type="button"
        aria-label="Stop and close"
        onClick={clear}
        className="hidden size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-selection hover:text-foreground focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none @min-[40rem]:flex"
      >
        <X size={13} aria-hidden />
      </button>
    </section>
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
  const presented = Boolean(item && presentedId === item.id);
  const value = useMemo<MediaDockValue>(
    () => ({ item, track, presented, load, clear, present }),
    [clear, item, load, present, presented, track],
  );

  return (
    <MediaDockContext.Provider value={value}>
      {children}
      {item ? <MediaDockAudio key={item.id} item={item} track={track} /> : null}
    </MediaDockContext.Provider>
  );
}
