import type { ReactNode } from "react";

import type { MediaStatus } from "./media-status";
import { MediaStatusChip } from "./MediaStatusChip";

export function MediaNotice({
  status,
  message,
  action,
}: {
  status: MediaStatus;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 p-6 text-center text-white">
      {status.state !== "idle" && <MediaStatusChip status={status} tone="overlay" />}
      <p className="max-w-sm font-display text-lg leading-snug text-balance">{message}</p>
      {action}
    </div>
  );
}

export function MediaNoticeAction({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform hover:scale-[1.03] disabled:opacity-60 disabled:hover:scale-100"
    >
      {icon}
      {label}
    </button>
  );
}
