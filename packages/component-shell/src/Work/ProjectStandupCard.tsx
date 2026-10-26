import { StandupSettingsForm } from "@ngriffin_uk/polychat-component-workspaces";
import { useChannelBindings, useStandupSettings } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

export function ProjectStandupCard({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const standup = useStandupSettings(projectId);
  const { visibleBindings } = useChannelBindings(projectId);

  return (
    <>
      {standup.data ? (
        <StandupSettingsForm
          key={JSON.stringify(standup.data)}
          settings={standup.data}
          channels={visibleBindings.map((binding) => ({
            id: binding.id,
            label: binding.label ?? binding.channel,
          }))}
          canManage={canManage}
          isSaving={standup.save.isPending}
          onSave={(settings) =>
            void standup.save
              .mutateAsync(settings)
              .then(() => toast.success("Standup saved"))
              .catch((error: unknown) =>
                toast.error(getErrorMessage(error, "Standup could not be saved")),
              )
          }
        />
      ) : null}
    </>
  );
}
