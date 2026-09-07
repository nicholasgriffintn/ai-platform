import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { HomePage } from "@ngriffin_uk/polychat-component-shell";

const DESKTOP_MODE_CONFIG: ThreadModeConfig = { analyticsSource: "desktop" };

export default function DesktopChatPage() {
  return <HomePage hostModeConfig={DESKTOP_MODE_CONFIG} />;
}
