import "../styles.css";

export interface MusicTransportControlsProps {
  isPlaying: boolean;
  isLoading?: boolean;
  canPlay?: boolean;
  unavailableReason?: string;
  onPlay: () => void;
  onStop: () => void;
}

export function MusicTransportControls({
  isPlaying,
  isLoading = false,
  canPlay = true,
  unavailableReason,
  onPlay,
  onStop,
}: MusicTransportControlsProps) {
  return (
    <div className="polychat-experience-music-transport" role="group" aria-label="Music transport">
      <button
        type="button"
        disabled={isLoading || !canPlay}
        title={!canPlay ? unavailableReason : undefined}
        onClick={isPlaying ? onStop : onPlay}
      >
        {isLoading ? "Loading…" : isPlaying ? "Stop" : "Play"}
      </button>
      {!canPlay && unavailableReason && <small>{unavailableReason}</small>}
    </div>
  );
}

export * from "./strudel";
export * from "./StrudelPlayer";
export * from "./examples";
export * from "./StrudelStudio";
export * from "./StrudelPatternForm";
export * from "./StrudelPatternGrid";
