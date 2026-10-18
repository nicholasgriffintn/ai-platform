import { ToolRulesEditor } from "../../ToolRules/ToolRulesEditor.js";
import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileToolRulesTab() {
  return (
    <ProfileTab
      title="Tool rules"
      description="Decide once how each tool is treated, instead of answering the same approval every time."
    >
      <ToolRulesEditor />
    </ProfileTab>
  );
}
