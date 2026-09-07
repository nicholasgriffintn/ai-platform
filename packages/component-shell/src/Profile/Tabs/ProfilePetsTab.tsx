import { PetsPanel } from "../PetsPanel.js";
import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfilePetsTab() {
  return (
    <ProfileTab
      title="Your pet"
      description="Your pet perches above the composer in Chat and Work, and reacts to what Polychat is doing."
    >
      <PetsPanel />
    </ProfileTab>
  );
}
