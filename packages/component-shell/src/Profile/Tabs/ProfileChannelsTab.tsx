import { ChannelSettings } from "../../Channels/ChannelSettings.js";
import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileChannelsTab() {
  return (
    <ProfileTab title="Channels">
      <ChannelSettings />
    </ProfileTab>
  );
}
