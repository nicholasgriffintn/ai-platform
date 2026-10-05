import { OperationGrantForm } from "@ngriffin_uk/polychat-component-capabilities";
import { connectorGrantSchema, type RecipeConnectorManifest } from "@ngriffin_uk/polychat-schemas";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";

export function ProjectConnectorGrantPanel({
  connector,
  scope,
}: {
  connector: RecipeConnectorManifest;
  scope: CapabilityLibraryScope;
}) {
  if (!scope.requiresExplicitEnablement || !connector.operations?.length) {
    return null;
  }

  const capability = scope.capabilities.find(
    (candidate) => candidate.kind === "connector" && candidate.capabilityId === connector.id,
  );
  const grant = connectorGrantSchema.safeParse(capability?.configuration);

  return (
    <OperationGrantForm
      key={`${connector.id}:${JSON.stringify(grant.success ? grant.data.operations : [])}`}
      operations={connector.operations ?? []}
      initialOperations={grant.success ? grant.data.operations : []}
      canManage={scope.canManage}
      isSaving={scope.projectMutations.add.isPending || scope.projectMutations.remove.isPending}
      error={(scope.projectMutations.add.error ?? scope.projectMutations.remove.error)?.message}
      onSave={(operations) => {
        void scope
          .add({ kind: "connector", capabilityId: connector.id, configuration: { operations } })
          .catch(() => undefined);
      }}
      onRevoke={capability ? () => scope.remove(capability) : undefined}
    />
  );
}
