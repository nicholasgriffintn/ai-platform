import { AuditList } from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  useModelAudit,
  useModelPermissions,
  useModelPlatformMutations,
} from "@ngriffin_uk/polychat-library-react";
import {
  MODEL_PLATFORM_ACTIONS,
  type ModelPermissions,
  type ModelPlatformAction,
} from "@ngriffin_uk/polychat-schemas";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

const ACTION_LABELS: Record<ModelPlatformAction, string> = {
  view: "View",
  import: "Import",
  upload: "Upload",
  build_datasets: "Build datasets",
  train: "Train",
  deploy: "Deploy",
  promote: "Promote aliases",
  approve: "Approve and revoke",
  manage_policy: "Edit policy",
  manage_connections: "Connect providers",
  manage_budgets: "Set budgets",
};

type EditableRole = "admin" | "member";

function PermissionsEditor({ permissions }: { permissions: ModelPermissions }) {
  const { workspaceId, can } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [grants, setGrants] = useState<Record<EditableRole, ModelPlatformAction[]>>({
    admin: permissions.grants.admin ?? [],
    member: permissions.grants.member ?? [],
  });
  const [separation, setSeparation] = useState(permissions.separationOfDuties);
  const editable = can("manage_policy");
  const toggle = (role: EditableRole, action: ModelPlatformAction, on: boolean) =>
    setGrants((current) => ({
      ...current,
      [role]: on ? [...current[role], action] : current[role].filter((item) => item !== action),
    }));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Owners</th>
              <th className="px-3 py-2 font-medium">Admins</th>
              <th className="px-3 py-2 font-medium">Members</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_PLATFORM_ACTIONS.map((action) => (
              <tr key={action} className="border-t border-border">
                <td className="px-3 py-2">{ACTION_LABELS[action]}</td>
                <td className="px-3 py-2 text-muted-foreground">Always</td>
                {(["admin", "member"] as const).map((role) => (
                  <td key={role} className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`${role} ${action}`}
                      disabled={!editable || action === "view"}
                      checked={action === "view" || grants[role].includes(action)}
                      onChange={(event) => toggle(role, action, event.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Switch
        label="Separation of duties: nobody approves their own request or model"
        checked={separation}
        disabled={!editable}
        onChange={(event) => setSeparation(event.target.checked)}
      />
      {editable && (
        <Button
          size="sm"
          variant="secondary"
          disabled={mutations.savePermissions.isPending}
          onClick={() =>
            void runWithToast("Permissions saved", () =>
              mutations.savePermissions.mutateAsync({ grants, separationOfDuties: separation }),
            )
          }
        >
          Save permissions
        </Button>
      )}
    </div>
  );
}

export function PermissionsSection() {
  const { workspaceId } = useModelsScope();
  const permissions = useModelPermissions(workspaceId);

  return (
    <ModelsSection
      title="Who can do what"
      description="Owners can always do everything. Everyone in the workspace can view."
    >
      {permissions.data ? (
        <PermissionsEditor
          key={permissions.data.updatedAt ?? "default"}
          permissions={permissions.data}
        />
      ) : (
        <CardSkeleton />
      )}
    </ModelsSection>
  );
}

export function AuditSection() {
  const { workspaceId } = useModelsScope();
  const audit = useModelAudit(workspaceId, { limit: 100 });
  const mutations = useModelPlatformMutations(workspaceId);

  const exportInventory = () =>
    runWithToast("Inventory exported", async () => {
      const inventory = await mutations.exportInventory.mutateAsync();

      downloadTextFile(
        `ai-inventory-${inventory.generatedAt.slice(0, 10)}.json`,
        JSON.stringify(inventory, null, 2),
        "application/json",
      );
    });

  return (
    <ModelsSection
      title="Audit trail"
      description="Every import, upload, run, deployment, promotion, decision and export, with who did it."
      actions={
        <Button size="sm" variant="ghost" onClick={() => void exportInventory()}>
          Export AI inventory
        </Button>
      }
    >
      {audit.data ? <AuditList events={audit.data} /> : <CardSkeleton />}
    </ModelsSection>
  );
}
