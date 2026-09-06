export function MetaAssistantOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return (
    <button type="button" onClick={onClose}>
      Close
    </button>
  );
}
