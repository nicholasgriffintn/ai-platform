import { Toaster } from "@ngriffin_uk/polychat-component-ui";

import { useThemeAppearance } from "~/hooks/useTheme";

export function ThemedToaster() {
  const appearance = useThemeAppearance();

  return <Toaster appearance={appearance} />;
}
