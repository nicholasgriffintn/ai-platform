import {
  CapabilityFilters,
  ToolConfigurationDialog,
  type CapabilityFilter,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
  CardGridLoadingSkeleton,
  ConfirmationDialog,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import type {
  CatalogueItemKind,
  ProjectCapabilityKindGroup,
} from "@ngriffin_uk/polychat-library-react";
import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { SearchX } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { AddSkillDialog } from "./AddSkillDialog.js";
import { AttachTeammateDialog } from "./AttachTeammateDialog.js";
import { CapabilityAddMenu } from "./CapabilityAddMenu.js";
import { CapabilityGroups } from "./CapabilityGroups.js";
import { HireTeammateDialog } from "./HireTeammateDialog.js";
import { SharedTeammatesDialog } from "./SharedTeammatesDialog.js";
import { ShareTeammateDialog } from "./ShareTeammateDialog.js";
import { useCapabilityAuthoring } from "./useCapabilityAuthoring.js";
import {
  DEFAULT_CAPABILITY_KINDS,
  useCapabilityLibraryController,
  type CapabilityLibraryScope,
} from "./useCapabilityLibraryController.js";

export function CapabilityLibrary({
  scope,
  title,
  subtitle,
  navigation,
  kinds = DEFAULT_CAPABILITY_KINDS,
  extraItems,
  renderGroup,
  children,
}: CapabilityLibraryProps) {
  const controller = useCapabilityLibraryController(scope, { kinds, extraItems });
  const authoring = useCapabilityAuthoring({
    capabilities: controller.capabilities,
    currentUserId: controller.currentUserId,
    kinds,
    projectActions: controller.projectActions,
    projectAddError: controller.projectMutations?.add.error,
    skillDeletion: controller.skillDeletion,
    surface: controller.surface,
  });
  const isLoading = controller.isLoadingScope || controller.catalog.isLoading;
  const managesTeammates = kinds.includes("teammate");
  const availableFilters = useMemo<CapabilityFilter[]>(
    () => [...(kinds.includes("tool") ? ["configured" as const] : []), ...kinds],
    [kinds],
  );
  const mutationError =
    controller.configurationMutation.error ??
    controller.projectMutations?.add.error ??
    controller.projectMutations?.remove.error ??
    controller.skillDeletion.error ??
    controller.personalSkills?.error;
  const pendingAddCapabilityId = controller.projectMutations?.add.isPending
    ? controller.projectMutations.add.variables?.capabilityId
    : undefined;
  const pendingRemoveId = controller.projectMutations?.remove.isPending
    ? controller.projectMutations.remove.variables?.capabilityId
    : undefined;
  const hasAuthenticationError =
    isAuthenticationError(controller.scopeError) ||
    isAuthenticationError(controller.catalog.error) ||
    isAuthenticationError(mutationError);

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header
          title={title}
          actionContent={<CapabilityAddMenu choices={authoring.addChoices} />}
        />
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
        {navigation}
        <CapabilityFilters
          availableFilters={availableFilters}
          categories={controller.filters.categories}
          category={controller.filters.category}
          filters={controller.filters.selected}
          searchLabel={managesTeammates ? "Search teammates" : "Search plugins"}
          searchPlaceholder={managesTeammates ? "Search teammates..." : "Search plugins..."}
          onCategoryChange={controller.filters.setCategory}
          onFiltersChange={controller.filters.setSelected}
          onQueryChange={controller.filters.setQuery}
          query={controller.filters.query}
        />
        {mutationError && !isAuthenticationError(mutationError) && (
          <p role="alert" className="mb-4 text-sm text-failure">
            {mutationError.message}
          </p>
        )}

        {hasAuthenticationError ? (
          <SignInEmptyState
            title={
              managesTeammates
                ? "Sign in to manage your teammates"
                : "Sign in to manage your plugins"
            }
            message={
              managesTeammates
                ? "Sign in to choose the teammates you use."
                : "Sign in to choose the apps, skills, tools and integrations you use."
            }
            className="min-h-[300px]"
          />
        ) : isLoading ? (
          <CardGridLoadingSkeleton count={6} label="Loading capabilities" />
        ) : controller.scopeError || controller.catalog.error ? (
          <EmptyState
            title="Capabilities unavailable"
            message={(controller.scopeError ?? controller.catalog.error)?.message ?? "Try again."}
          />
        ) : controller.catalog.groups.length === 0 ? (
          <EmptyState
            icon={<SearchX size={24} className="text-muted-foreground" />}
            title="Nothing matches"
            message="Try another search, type, or category."
            className="min-h-[240px]"
          />
        ) : (
          <CapabilityGroups
            appById={controller.catalog.appById}
            capabilities={controller.capabilities}
            currentUserId={controller.currentUserId}
            experiences={controller.catalog.experiences}
            groups={controller.catalog.groups}
            pendingAddCapabilityId={pendingAddCapabilityId}
            pendingRemoveId={pendingRemoveId}
            onConfigureTool={controller.toolConfigurationDialog.open}
            personalSkills={controller.personalSkills}
            projectActions={controller.projectActions}
            toolById={controller.catalog.toolById}
            toolConfigurationById={controller.toolConfigurationById}
            surface={controller.surface}
            teammateActions={authoring.teammateActions}
            authoredSkillActions={authoring.authoredSkillActions}
            renderGroup={renderGroup}
          />
        )}
        {children}
      </PageShell.Content>

      <ToolConfigurationDialog
        configuration={controller.toolConfigurationDialog.configuration}
        isLoading={controller.toolConfigurationDialog.isLoading}
        onClose={controller.toolConfigurationDialog.close}
        onSubmit={controller.toolConfigurationDialog.submit}
        tool={controller.toolConfigurationDialog.tool}
      />
      <AddSkillDialog
        open={authoring.addSkill.open}
        onOpenChange={authoring.addSkill.setOpen}
        projectId={controller.surface.projectId}
      />
      <HireTeammateDialog
        open={authoring.hireTeammate.open}
        onOpenChange={authoring.hireTeammate.setOpen}
        onHire={authoring.hireTeammate.hire}
        isHiring={authoring.hireTeammate.isHiring}
        error={authoring.hireTeammate.error}
        workspaceId={controller.surface.workspaceId}
      />
      <SharedTeammatesDialog
        open={authoring.browseSharedTeammates.open}
        onOpenChange={authoring.browseSharedTeammates.setOpen}
      />
      <ShareTeammateDialog
        teammate={authoring.shareTeammate.teammate}
        onClose={authoring.shareTeammate.close}
      />
      <AttachTeammateDialog
        teammates={authoring.attachTeammate.teammates}
        error={authoring.attachTeammate.error}
        isLoading={authoring.attachTeammate.isLoading}
        onAttach={authoring.attachTeammate.attach}
        onOpenChange={authoring.attachTeammate.setOpen}
        open={authoring.attachTeammate.open}
        pendingTeammateId={pendingAddCapabilityId}
      />
      <ConfirmationDialog
        open={authoring.deletion.pending !== null}
        onOpenChange={(open) => {
          if (!open && !authoring.deletion.isPending) {
            authoring.deletion.cancel();
          }
        }}
        title={`Delete ${authoring.deletion.pending?.kind ?? "capability"}`}
        description={`Delete ${
          authoring.deletion.pending?.label ?? "this capability"
        }? This cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        isLoading={authoring.deletion.isPending}
        onConfirm={authoring.deletion.confirm}
      >
        {authoring.deletion.error && (
          <p role="alert" className="text-sm text-failure">
            {authoring.deletion.error.message}
          </p>
        )}
      </ConfirmationDialog>
    </>
  );
}

interface CapabilityLibraryProps {
  children?: ReactNode;
  extraItems?: readonly AssistantActionItem[];
  kinds?: readonly CatalogueItemKind[];
  renderGroup?: (group: ProjectCapabilityKindGroup) => ReactNode;
  scope: CapabilityLibraryScope;
  title: string;
  subtitle: string;
  navigation?: ReactNode;
}
