import { type ComponentProps, Suspense, lazy, useMemo } from "react";

import type { IconType } from "./icon-type";
import { ICON_LOADERS } from "./iconLoaders";

export interface ProviderGlyphProps extends ComponentProps<IconType> {
  name: string;
}

export function ProviderGlyph({ name, ...props }: ProviderGlyphProps) {
  const Icon = useMemo(() => {
    const loadIcon = ICON_LOADERS[name];

    return loadIcon ? lazy(loadIcon) : null;
  }, [name]);

  if (!Icon) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <Icon {...props} />
    </Suspense>
  );
}
