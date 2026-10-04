import {
  CapabilityCategoryGroup,
  CapabilityGroupSection,
  CatalogueCard,
} from "@ngriffin_uk/polychat-component-capabilities";
import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type {
  EnabledCapability,
  ProjectCapabilityKindGroup,
} from "@ngriffin_uk/polychat-library-react";
import type { IntegrationDefinition } from "@ngriffin_uk/polychat-schemas";
import { Plug } from "lucide-react";

export function NativeIntegrationGroup({
  group,
  definitionsById,
  capabilities,
  requiresProjectGrant,
  onSelect,
}: {
  group: ProjectCapabilityKindGroup;
  definitionsById: ReadonlyMap<string, IntegrationDefinition>;
  capabilities: readonly EnabledCapability[];
  requiresProjectGrant: boolean;
  onSelect: (id: string) => void;
}) {
  const count = group.categories.reduce((total, category) => total + category.items.length, 0);

  return (
    <CapabilityGroupSection id="custom-integrations" label={group.label} count={count}>
      {group.categories.map((category) => (
        <CapabilityCategoryGroup
          key={category.category}
          category={category.category}
          gridClassName="block"
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {category.items.map((item) => {
              const definition = definitionsById.get(item.capability.id);

              if (!definition) {
                return null;
              }

              const enabled = capabilities.some(
                (capability) =>
                  capability.kind === "integration" &&
                  capability.capabilityId === definition.id &&
                  !capability.excluded,
              );

              return (
                <CatalogueCard
                  key={item.id}
                  icon={<Plug aria-hidden="true" size={20} />}
                  title={item.label}
                  description={item.description ?? ""}
                  badges={
                    <>
                      <Badge variant="outline">
                        {definition.connected ? "Account connected" : "Connect your account"}
                      </Badge>
                      {requiresProjectGrant && (
                        <Badge variant="outline">
                          {enabled ? "Enabled in project" : "Project access required"}
                        </Badge>
                      )}
                    </>
                  }
                  footer={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSelect(definition.id)}
                    >
                      Manage integration
                    </Button>
                  }
                />
              );
            })}
          </ul>
        </CapabilityCategoryGroup>
      ))}
    </CapabilityGroupSection>
  );
}
