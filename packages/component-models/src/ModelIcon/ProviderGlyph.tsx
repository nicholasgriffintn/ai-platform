import { type ComponentProps, type ReactNode, Suspense, lazy, useMemo } from "react";

import type { IconType } from "./icon-type";
import { ICON_LOADERS } from "./iconLoaders";

export interface ProviderGlyphProps extends ComponentProps<IconType> {
  name: string;
  fallback?: ReactNode;
}

export function ProviderGlyph({ name, fallback = null, ...props }: ProviderGlyphProps) {
  const Icon = useMemo(() => {
    const loadIcon = ICON_LOADERS[name];

    return loadIcon ? lazy(loadIcon) : null;
  }, [name]);

  if (!Icon) {
    return fallback;
  }

  return (
    <Suspense fallback={fallback}>
      <Icon {...props} />
    </Suspense>
  );
}
