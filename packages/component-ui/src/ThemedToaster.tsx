import { useThemeAppearance } from "@ngriffin_uk/polychat-library-react";

import { Toaster } from "./sonner";

export function ThemedToaster() {
  const appearance = useThemeAppearance();

  return <Toaster appearance={appearance} />;
}
