import { Pet } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useCharacterPresence, usePolyAgenda } from "@ngriffin_uk/polychat-library-react";

import { hidePolyPerch, openPolyWindow } from "./infrastructure/poly-bridge";

const PERCH_PET_SIZE = 76;

export function PerchWindow() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const { data: agenda } = usePolyAgenda(isAuthenticated);
  const presence = useCharacterPresence({ conversationId: agenda?.conversation_id });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="group relative flex h-dvh w-full flex-col items-center justify-end overflow-hidden rounded-2xl border border-border bg-canvas pb-2 select-none">
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-5 cursor-grab" />
      <button
        type="button"
        aria-label="Hide Poly from the desktop"
        className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => void hidePolyPerch()}
      >
        <span aria-hidden="true" className="block text-xs leading-none">
          ×
        </span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center gap-1 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Open Poly. ${presence.status}`}
        onClick={() => void openPolyWindow()}
      >
        <Pet
          size={PERCH_PET_SIZE}
          conversationId={agenda?.conversation_id}
          href={null}
          showNudges={false}
          placement="top"
        />
        <span className="max-w-[7rem] truncate text-[10px] text-muted-foreground">
          {presence.status}
        </span>
      </button>
    </div>
  );
}
