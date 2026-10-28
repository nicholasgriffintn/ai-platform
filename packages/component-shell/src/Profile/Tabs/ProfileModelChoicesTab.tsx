import { ConversationModelSettings } from "../../Models/Choices/ConversationModelSettings.js";
import { ModelChoicesEditor } from "../../Models/Choices/ModelChoicesEditor.js";
import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileModelChoicesTab() {
  return (
    <ProfileTab
      title="Model choices"
      description="Every model Polychat picks for you, in one place. Background jobs take a first choice plus fallbacks in order: the first model runs and the rest step in when it fails. Anything you leave alone runs on the platform defaults on Workers AI."
    >
      <div className="space-y-8">
        <ConversationModelSettings />
        <ModelChoicesEditor />
      </div>
    </ProfileTab>
  );
}
