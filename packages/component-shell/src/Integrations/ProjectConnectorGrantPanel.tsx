import { OperationGrantForm } from "@ngriffin_uk/polychat-component-capabilities";
import { useConnectorGrantOperations } from "@ngriffin_uk/polychat-library-react";
import { connectorGrantSchema, type RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";

export function ProjectConnectorGrantPanel({
  provider,
  scope,
}: {
  provider: RecipeConnectorProvider;
  scope: CapabilityLibraryScope;
}) {
  const query = useConnectorGrantOperations(provider);

  if (!scope.requiresExplicitEnablement) {
    return null;
  }

  const capability = scope.capabilities.find(
    (candidate) => candidate.kind === "connector" && candidate.capabilityId === provider,
  );
  const grant = connectorGrantSchema.safeParse(capability?.configuration);

  if (query.isLoading) {
    return <output>Loading available actions…</output>;
  }

  if (query.error) {
    return (
      <p role="alert" className="text-failure">
        {query.error.message}
      </p>
    );
  }

  return (
    <OperationGrantForm
      key={`${provider}:${JSON.stringify(grant.success ? grant.data.operations : [])}`}
      operations={query.data?.operations ?? []}
      initialOperations={grant.success ? grant.data.operations : []}
      canManage={scope.canManage}
      isSaving={scope.projectMutations.add.isPending || scope.projectMutations.remove.isPending}
      error={(scope.projectMutations.add.error ?? scope.projectMutations.remove.error)?.message}
      onSave={(operations) => {
        void scope
          .add({ kind: "connector", capabilityId: provider, configuration: { operations } })
          .catch(() => undefined);
      }}
      onRevoke={capability ? () => scope.remove(capability) : undefined}
    />
  );
}
