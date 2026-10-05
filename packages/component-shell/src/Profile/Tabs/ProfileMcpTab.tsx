import { FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { useWorkspaces } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { McpRegistrySettings } from "../../Mcp/McpRegistrySettings.js";
import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileMcpTab() {
  const workspaces = useWorkspaces();
  const [scope, setScope] = useState("personal");

  return (
    <ProfileTab title="Connected tools">
      <FormSelect
        label="Catalogue"
        value={scope}
        onValueChange={setScope}
        options={[
          { value: "personal", label: "Personal" },
          ...(workspaces.data?.workspaces ?? []).map((workspace) => ({
            value: workspace.id,
            label: workspace.name,
          })),
        ]}
      />
      <McpRegistrySettings key={scope} workspaceId={scope === "personal" ? undefined : scope} />
    </ProfileTab>
  );
}
