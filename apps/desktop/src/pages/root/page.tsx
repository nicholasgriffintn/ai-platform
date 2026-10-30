import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { DiscoverHomePage } from "@ngriffin_uk/polychat-component-shell";

const DESKTOP_MODE_CONFIG: ThreadModeConfig = { analyticsSource: "desktop" };

export default function RootPage() {
  return <DiscoverHomePage hostModeConfig={DESKTOP_MODE_CONFIG} />;
}
