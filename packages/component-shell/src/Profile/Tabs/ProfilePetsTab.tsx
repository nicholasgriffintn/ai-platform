import { PetsPanel } from "../PetsPanel";
import { ProfileTab } from "../ProfileTabLayout";

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
