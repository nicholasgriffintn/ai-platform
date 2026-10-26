import { CreateWorkspaceDialog as ControlledCreateWorkspaceDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useStartOnboarding, useTeamTemplates } from "@ngriffin_uk/polychat-library-react";
import { creditMicrosFromCredits } from "@ngriffin_uk/polychat-schemas";
import { useNavigate } from "react-router";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const startOnboarding = useStartOnboarding();
  const teamTemplates = useTeamTemplates(open);

  return (
    <ControlledCreateWorkspaceDialog
      open={open}
      teamTemplates={teamTemplates.data ?? []}
      isSubmitting={startOnboarding.isPending}
      errorMessage={startOnboarding.error?.message}
      onOpenChange={onOpenChange}
      onSubmit={async ({ name, mission, sources, monthlyCredits, templateId }) => {
        const setup = await startOnboarding.mutateAsync({
          templateId,
          name,
          mission,
          sources,
          monthlyCreditCapMicros: monthlyCredits ? creditMicrosFromCredits(monthlyCredits) : null,
          colour: "#2563EB",
        });

        onOpenChange(false);
        void navigate(`/work/${setup.workspaceId}/setup`);
      }}
    />
  );
}
