import { PetSprite } from "@ngriffin_uk/polychat-component-ui";
import {
  type PetSheetLayout,
  POLYCHAT_SHEET_LAYOUT,
  resolvePetClipIn,
} from "@ngriffin_uk/polychat-schemas";

import { usePetShowreel } from "~/hooks/usePetShowreel";

export interface PetPreviewProps {
  sheetUrl: string;
  label: string;
  layout?: PetSheetLayout;
  size?: number;
  paused?: boolean;
  className?: string;
}

export function PetPreview({
  sheetUrl,
  label,
  layout = POLYCHAT_SHEET_LAYOUT,
  size = 64,
  paused = false,
  className,
}: PetPreviewProps) {
  const showreel = usePetShowreel(!paused, layout);

  return (
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
  );
}
