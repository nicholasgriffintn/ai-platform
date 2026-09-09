import { forwardRef, lazy, type LazyExoticComponent } from "react";

import type { IconType } from "./icon-type";
import { ICON_LOADERS } from "./iconLoaders";

const MissingIcon: IconType = forwardRef(() => null);
const lazyIcons = new Map<string, LazyExoticComponent<IconType>>();

export function getLazyIcon(iconName: string): LazyExoticComponent<IconType> | null {
  const loadIcon = ICON_LOADERS[iconName];

  if (!loadIcon) {
    return null;
  }

  const cached = lazyIcons.get(iconName);

  if (cached) {
    return cached;
  }

  const icon = lazy(() => loadIcon().catch(() => ({ default: MissingIcon })));

  lazyIcons.set(iconName, icon);

  return icon;
}
