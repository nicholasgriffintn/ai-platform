import {
  ConnectorLogo,
  ProviderCatalogueRow,
  type ProviderCatalogueItem,
} from "@ngriffin_uk/polychat-component-account";
import {
  CapabilityCategoryGroup,
  CapabilityGroupSection,
} from "@ngriffin_uk/polychat-component-capabilities";
import type { ProjectCapabilityKindGroup } from "@ngriffin_uk/polychat-library-react";
import type {
  RecipeConnectorManifest,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

export function PluginsConnectorGroup({
  group,
  manifestsById,
  connectingProviderId,
  onSelect,
}: {
  group: ProjectCapabilityKindGroup;
  manifestsById: Map<RecipeConnectorProvider, RecipeConnectorManifest>;
  connectingProviderId: RecipeConnectorProvider | null;
  onSelect: (connector: RecipeConnectorManifest) => void;
}) {
  const count = group.categories.reduce((total, category) => total + category.items.length, 0);

  return (
    <CapabilityGroupSection id={group.kind} label={group.label} count={count}>
      {group.categories.map((categoryGroup) => (
        <CapabilityCategoryGroup
          key={categoryGroup.category}
          category={categoryGroup.category}
          gridClassName="grid gap-1 lg:grid-cols-2"
        >
          {categoryGroup.items.map((item) => {
            const connector = manifestsById.get(item.capability.id);

            if (!connector) {
              return null;
            }

            const catalogueItem: ProviderCatalogueItem = {
              id: item.id,
              name: connector.name,
              description: connector.description,
              category: categoryGroup.category,
              connected: connector.status === "connected",
              connecting: connectingProviderId === connector.id,
              icon: <ConnectorLogo connector={connector} />,
              onSelect: () => onSelect(connector),
            };

            return <ProviderCatalogueRow key={item.id} item={catalogueItem} />;
          })}
        </CapabilityCategoryGroup>
      ))}
    </CapabilityGroupSection>
  );
}
