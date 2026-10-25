import { ProfilePage, type ProfileSidebarItem } from "@ngriffin_uk/polychat-component-shell";

import { ActivitySettingsTab } from "./activity/ActivitySettingsTab.js";
import { RuntimeSettingsTab } from "./RuntimeSettingsTab.js";

const desktopProfileItems: readonly ProfileSidebarItem[] = [
  {
    id: "activity",
    label: "Mac activity",
    group: "Account",
    pageTitle: "Activity on this Mac",
    component: ActivitySettingsTab,
  },
  {
    id: "runtimes",
    label: "Runtimes",
    group: "Models and keys",
    component: RuntimeSettingsTab,
  },
];

export default function DesktopProfilePage() {
  return <ProfilePage additionalItems={desktopProfileItems} />;
}
