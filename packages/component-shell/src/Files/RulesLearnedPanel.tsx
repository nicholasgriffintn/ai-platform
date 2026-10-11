import { RulesLearnedPanel as ControlledRulesLearnedPanel } from "@ngriffin_uk/polychat-component-account";
import { useCorrections } from "@ngriffin_uk/polychat-library-react";

export function RulesLearnedPanel() {
  const { corrections, isLoading, dismiss, dismissingId } = useCorrections();

  return (
    <ControlledRulesLearnedPanel
      corrections={corrections}
      isLoading={isLoading}
      dismissingId={dismissingId}
      onDismiss={dismiss}
    />
  );
}
