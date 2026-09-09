import { type ComponentProps, type ReactNode, Suspense } from "react";

import type { IconType } from "./icon-type";
import { getLazyIcon } from "./lazyIcons";
import { resolveProviderIconName } from "./resolveIconName";

export interface ProviderGlyphProps extends ComponentProps<IconType> {
  name: string;
  fallback?: ReactNode;
}

export function ProviderGlyph({ name, fallback = null, ...props }: ProviderGlyphProps) {
  const iconName = resolveProviderIconName(name);
  const Icon = iconName ? getLazyIcon(iconName) : null;

  if (!Icon) {
    return fallback;
  }

  return (
    <Suspense fallback={fallback}>
      <Icon {...props} />
    </Suspense>
  );
}
