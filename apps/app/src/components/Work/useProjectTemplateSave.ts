import type { ProjectDetail } from "@ngriffin_uk/polychat-schemas";
import { toast } from "sonner";

import { useTemplateMutations } from "~/hooks/useGovernance";
import { getErrorMessage } from "~/lib/errors";

export function useProjectTemplateSave(workspaceId: string, project: ProjectDetail | null) {
  const templates = useTemplateMutations(workspaceId);

  return {
    isSaving: templates.create.isPending,
    save: async () => {
      if (!project) {
        return;
      }

      try {
        await templates.create.mutateAsync({
          workspaceId,
          kind: "project",
          name: project.name,
          description: project.description,
          configuration: {
            project: {
              name: project.name,
              description: project.description,
              instructions: project.instructions,
              colour: project.colour,
              defaultModelTier: project.defaultModelTier,
              codingEnvironment: project.codingEnvironment,
            },
            capabilities: project.capabilities.map((capability) => ({
              kind: capability.kind,
              capabilityId: capability.capabilityId,
              configuration: capability.configuration,
            })),
          },
          status: "active",
        });
        toast.success("Project template saved");
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to save project template"));
      }
    },
  };
}
