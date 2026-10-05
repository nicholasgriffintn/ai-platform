import { ChannelConnections } from "../../Channels/ChannelConnections.js";
import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileChannelsTab() {
  return (
    <ProfileTab title="Channels">
      <ChannelConnections />
    </ProfileTab>
  );
}
