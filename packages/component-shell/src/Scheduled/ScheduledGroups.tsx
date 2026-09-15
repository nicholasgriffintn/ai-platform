import {
  CapabilityCategoryGroup,
  CapabilityGroupSection,
} from "@ngriffin_uk/polychat-component-capabilities";
import type {
  EnabledCapability,
  ProjectCapabilityKindGroup,
} from "@ngriffin_uk/polychat-library-react";
import type {
  AssistantActionItem,
  AssistantRecipe,
  ProjectCapabilityKind,
  RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";

import { resolveCapabilityCardState } from "../Capabilities/capabilityCardState.js";
import { RecipeCapabilityCard } from "../Capabilities/RecipeCapabilityCard.js";
import type { useRecipeWorkflows } from "../Recipes/useRecipeWorkflows.js";

interface ScheduledGroupsProps {
  capabilities: EnabledCapability[];
  currentUserId?: string | number;
  groups: ProjectCapabilityKindGroup[];
  pendingAddCapabilityId?: string;
  pendingRemoveId?: string;
  projectActions?: {
    canManage: boolean;
    addItem: (item: AssistantActionItem, kind: ProjectCapabilityKind) => void;
    removeCapability: (capability: EnabledCapability & { id: string }) => void;
  };
  recipeById: Map<string, AssistantRecipe>;
  recipeInstallationById: Map<string, RecipeInstallation>;
  workflows: ReturnType<typeof useRecipeWorkflows>;
}

export function ScheduledGroups({
  capabilities,
  currentUserId,
  groups,
  pendingAddCapabilityId,
  pendingRemoveId,
  projectActions,
  recipeById,
  recipeInstallationById,
  workflows,
}: ScheduledGroupsProps) {
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <CapabilityGroupSection
          key={group.kind}
          id={group.kind}
          label={group.label}
          count={group.categories.reduce((total, item) => total + item.items.length, 0)}
        >
          {group.categories.map((categoryGroup) => (
            <CapabilityCategoryGroup key={categoryGroup.category} category={categoryGroup.category}>
              <>
                {categoryGroup.items.map((item) => {
                  const recipe = recipeById.get(item.capability.id);

                  if (!recipe) {
                    return null;
                  }

                  const cardState = resolveCapabilityCardState(item, "recipe", {
                    canManageProject: projectActions?.canManage,
                    capabilities,
                    currentUserId,
                    pendingAddCapabilityId,
                    pendingRemoveId,
                  });

                  return (
                    <RecipeCapabilityCard
                      key={item.id}
                      capability={cardState.existing}
                      installation={recipeInstallationById.get(recipe.id)}
                      projectActions={
                        projectActions
                          ? {
                              canManage: cardState.canManage,
                              isAdding: cardState.isAdding,
                              isRemoving: cardState.isRemoving,
                              onAdd: () => projectActions.addItem(item, "recipe"),
                              onRemove: () => {
                                if (cardState.existing) {
                                  projectActions.removeCapability(cardState.existing);
                                }
                              },
                            }
                          : undefined
                      }
                      recipe={recipe}
                      workflows={workflows}
                    />
                  );
                })}
              </>
            </CapabilityCategoryGroup>
          ))}
        </CapabilityGroupSection>
      ))}
    </div>
  );
}
