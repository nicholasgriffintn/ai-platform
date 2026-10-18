import { Pet } from "@ngriffin_uk/polychat-component-ui";
import { useRef } from "react";

const TAPS_FOR_FLOCK = 5;
const TAP_WINDOW_MS = 2000;

export interface PolyFaceProps {
  conversationId?: string | null;
  size?: number;
  onFlock?: () => void;
}

export function PolyFace({ conversationId, size = 28, onFlock }: PolyFaceProps) {
  const taps = useRef<number[]>([]);

  const handleTap = () => {
    if (!onFlock) {
      return;
    }

    const now = Date.now();

    taps.current = [...taps.current.filter((at) => now - at < TAP_WINDOW_MS), now];

    if (taps.current.length >= TAPS_FOR_FLOCK) {
      taps.current = [];
      onFlock();
    }
  };

  const face = (
    <Pet
      size={size}
      conversationId={conversationId}
      href={null}
      showNudges={false}
      placement="top"
    />
  );

  if (!onFlock) {
    return face;
  }

  return (
    <button
      type="button"
      className="inline-flex shrink-0 rounded-md leading-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label="Poly"
      onClick={handleTap}
    >
      {face}
    </button>
  );
}
