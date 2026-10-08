const DEFAULT_PENDING_LABEL = "Still preening this one. It lands here when it is ready.";

export function GenerationPendingCard({ label }: { label?: string }) {
  return (
    <output
      aria-live="polite"
      className="polychat-motion-glow flex min-h-36 w-full max-w-sm items-center justify-center rounded-xl border border-border/60 bg-surface-elevated px-4 py-6 text-sm"
    >
      <span className="polychat-motion-sheen" aria-hidden="true" />
      <span className="polychat-motion-shimmer text-center">{label || DEFAULT_PENDING_LABEL}</span>
    </output>
  );
}
