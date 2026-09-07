import { ProfilePage, type ProfileSidebarItem } from "@ngriffin_uk/polychat-component-shell";

import { RuntimeSettingsTab } from "./RuntimeSettingsTab.js";

const desktopProfileItems: readonly ProfileSidebarItem[] = [
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
