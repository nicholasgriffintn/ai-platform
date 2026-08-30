import { PetSprite } from "@ngriffin_uk/polychat-component-ui";
import {
  type PetSheetLayout,
  POLYCHAT_SHEET_LAYOUT,
  resolvePetClipIn,
} from "@ngriffin_uk/polychat-schemas";

import { useDeferredPetPreview } from "~/hooks/useDeferredPetPreview";
import { usePetShowreel } from "~/hooks/usePetShowreel";

export interface PetPreviewProps {
  sheetUrl: string;
  label: string;
  layout?: PetSheetLayout;
  size?: number;
  paused?: boolean;
  deferLoading?: boolean;
  className?: string;
}

export function PetPreview({
  sheetUrl,
  label,
  layout = POLYCHAT_SHEET_LAYOUT,
  size = 64,
  paused = false,
  deferLoading = false,
  className,
}: PetPreviewProps) {
  const { previewRef, ready } = useDeferredPetPreview(deferLoading);
  const showreel = usePetShowreel(ready && !paused, layout);

  if (!ready) {
    return (
      <span
        ref={previewRef}
        aria-label={label}
        className={className}
        style={{ display: "inline-block", width: size, height: size }}
      />
    );
  }

  return (
    <span ref={previewRef} className="inline-flex">
      <PetSprite
        sheetUrl={sheetUrl}
        layout={layout}
        clip={resolvePetClipIn(layout, showreel.clip)}
        label={label}
        size={size}
        facing={showreel.facing}
        paused={paused}
        className={className}
      />
    </span>
  );
}
