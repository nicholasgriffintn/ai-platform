import { CreateWorkspaceDialog as ControlledCreateWorkspaceDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useStartOnboarding } from "@ngriffin_uk/polychat-library-react";
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

  return (
    <ControlledCreateWorkspaceDialog
      open={open}
      isSubmitting={startOnboarding.isPending}
      errorMessage={startOnboarding.error?.message}
      onOpenChange={onOpenChange}
      onSubmit={async ({ name, mission, sources, monthlyCredits }) => {
        const setup = await startOnboarding.mutateAsync({
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
