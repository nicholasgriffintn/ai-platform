import {
  getIntegrationManagementPath,
  useCanAccessProFeatures,
  useNativeIntegrationActions,
  useNativeIntegrations,
} from "@ngriffin_uk/polychat-library-react";
import { createNativeIntegrationAssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";

export function useNativeIntegrationCatalogue(scope: CapabilityLibraryScope) {
  const query = useNativeIntegrations(scope.surface);
  const actions = useNativeIntegrationActions();
  const canAccessPro = useCanAccessProFeatures();
  const [selectedId, setSelectedId] = useState<string>();
  const [searchParams, setSearchParams] = useSearchParams();
  const definitions = useMemo(() => query.data?.integrations ?? [], [query.data?.integrations]);
  const definitionsById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );
  const selected = selectedId ? definitionsById.get(selectedId) : undefined;
  const requested = definitionsById.get(searchParams.get("integration") ?? "");

  if (requested && selectedId !== requested.id) {
    setSelectedId(requested.id);
  }

  useEffect(() => {
    if (!requested) {
      return;
    }

    const next = new URLSearchParams(searchParams);

    next.delete("integration");
    setSearchParams(next, { replace: true });
  }, [requested, searchParams, setSearchParams]);

  const items = useMemo(
    () =>
      definitions.map((definition) =>
        createNativeIntegrationAssistantActionItem(
          definition,
          getIntegrationManagementPath(scope.surface, definition.id),
        ),
      ),
    [definitions, scope.surface],
  );

  return { query, actions, canAccessPro, definitionsById, selected, setSelectedId, items };
}

export type NativeIntegrationCatalogue = ReturnType<typeof useNativeIntegrationCatalogue>;
