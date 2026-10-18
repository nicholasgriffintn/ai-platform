import { PetSprite } from "@ngriffin_uk/polychat-component-ui";
import { PET_FLOCK } from "@ngriffin_uk/polychat-library-react";
import { POLYCHAT_SHEET_LAYOUT, resolvePetClipIn } from "@ngriffin_uk/polychat-schemas";
import { useEffect } from "react";

const BOW_MS = 4200;
const FLOCK_SIZE = 56;

export function PolyFlock({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, BOW_MS);

    return () => window.clearTimeout(timeout);
  }, [onDone]);

  return (
    <output className="pointer-events-none absolute inset-x-0 top-14 z-20 flex flex-col items-center gap-2 px-4">
      <div className="flex items-end gap-1 rounded-xl border border-border bg-surface-elevated/95 px-4 pt-3 pb-2 shadow-[var(--polychat-elevated-shadow)]">
        {PET_FLOCK.members.map((member) => (
          <PetSprite
            key={member.slug}
            sheetUrl={member.sheetUrl}
            layout={POLYCHAT_SHEET_LAYOUT}
            clip={resolvePetClipIn(POLYCHAT_SHEET_LAYOUT, "greet")}
            label={member.name}
            size={FLOCK_SIZE}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{PET_FLOCK.standfirst} They insisted.</p>
    </output>
  );
}
