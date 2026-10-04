import { CreateIntegrationForm } from "@ngriffin_uk/polychat-component-capabilities";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";
import { NativeIntegrationDetails } from "./NativeIntegrationDetails.js";
import type { NativeIntegrationCatalogue } from "./useNativeIntegrationCatalogue.js";

export function NativeIntegrationsPanel({
  scope,
  controller,
}: {
  scope: CapabilityLibraryScope;
  controller: NativeIntegrationCatalogue;
}) {
  const { query, actions, selected, setSelectedId } = controller;
  const canCreate = !scope.requiresExplicitEnablement || scope.canManage;

  if (!controller.canAccessPro) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      {query.isLoading && <output>Loading custom integrations…</output>}
      {query.error && (
        <p role="alert" className="text-failure">
          {query.error.message}
        </p>
      )}
      {canCreate && !scope.error && (
        <CreateIntegrationForm
          isSaving={actions.create.isPending}
          error={actions.create.error?.message}
          onCreate={async (input) => {
            const result = await actions.create.mutateAsync({
              ...input,
              workspaceId: scope.surface.workspaceId,
            });

            setSelectedId(result.integration.id);
            actions.create.reset();
          }}
        />
      )}
      {selected && (
        <NativeIntegrationDetails
          key={selected.id}
          definition={selected}
          scope={scope}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </div>
  );
}
