import { CapabilityFilters } from "@ngriffin_uk/polychat-component-capabilities";
import {
  CardGridLoadingSkeleton,
  ConfirmationDialog,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";
import { ConnectorSetupDialogs } from "../Connectors/ConnectorSetupDialogs.js";
import { RecipeWorkflowDialogs } from "../Recipes/RecipeWorkflowDialogs.js";
import { PageShell } from "../Shell/PageShell.js";
import { ScheduledGroups } from "./ScheduledGroups.js";
import { useScheduledLibraryController } from "./useScheduledLibraryController.js";

export function ScheduledLibrary({ scope, title, subtitle, navigation }: ScheduledLibraryProps) {
  const controller = useScheduledLibraryController(scope);
  const projectMutations = scope.requiresExplicitEnablement ? scope.projectMutations : undefined;
  const pendingAddCapabilityId = projectMutations?.add.isPending
    ? projectMutations.add.variables?.capabilityId
    : undefined;
  const pendingRemoveId = projectMutations?.remove.isPending
    ? projectMutations.remove.variables?.capabilityId
    : undefined;
  const workflows = controller.workflows;
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const showSignIn = !isAuthenticationLoading && !isAuthenticated;
  const hasAuthenticationError =
    showSignIn || isAuthenticationError(controller.error) || isAuthenticationError(scope.error);

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header title={title} />
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
        {navigation}
        <CapabilityFilters
          availableFilters={["configured", "recipe"]}
          categories={controller.categories}
          category={controller.category}
          filters={controller.selectedFilters}
          searchPlaceholder="Search automations..."
          onCategoryChange={controller.setCategory}
          onFiltersChange={controller.setSelectedFilters}
          onQueryChange={controller.setQuery}
          query={controller.query}
        />

        {hasAuthenticationError ? (
          <SignInEmptyState
            title="Sign in to manage your scheduled work"
            message="Sign in to see the automations you have installed and the schedules they run on."
            className="min-h-[300px]"
          />
        ) : controller.isLoading ? (
          <CardGridLoadingSkeleton count={6} label="Loading automations" />
        ) : controller.error ? (
          <EmptyState
            title="Automations unavailable"
            message={controller.error.message ?? "Try again."}
          />
        ) : controller.groups.length === 0 ? (
          <EmptyState
            icon={<SearchX size={24} className="text-muted-foreground" />}
            title="Nothing matches"
            message="Try another search, category, or filter."
            className="min-h-[240px]"
          />
        ) : (
          <ScheduledGroups
            capabilities={scope.capabilities}
            currentUserId={controller.currentUserId}
            groups={controller.groups}
            pendingAddCapabilityId={pendingAddCapabilityId}
            pendingRemoveId={pendingRemoveId}
            projectActions={
              scope.requiresExplicitEnablement
                ? {
                    canManage: scope.canManage,
                    addItem: controller.addItem,
                    removeCapability: controller.removeCapability,
                  }
                : undefined
            }
            recipeById={controller.recipeById}
            recipeInstallationById={controller.installationByRecipeId}
            workflows={workflows}
          />
        )}
      </PageShell.Content>

      <RecipeWorkflowDialogs workflows={workflows} />
      <ConfirmationDialog
        open={workflows.deleteDialog.installation !== null}
        onOpenChange={(open) => !open && workflows.deleteDialog.setInstallation(null)}
        title="Remove recipe"
        description="This removes your installed recipe and stops its configured schedules. The recipe itself stays available."
        confirmText="Remove"
        variant="destructive"
        isLoading={workflows.deleteDialog.isLoading}
        onConfirm={workflows.deleteDialog.submit}
      />
      <ConnectorSetupDialogs controller={workflows.connectorSetup} />
    </>
  );
}

interface ScheduledLibraryProps {
  scope: CapabilityLibraryScope;
  title: string;
  subtitle: string;
  navigation?: ReactNode;
}
