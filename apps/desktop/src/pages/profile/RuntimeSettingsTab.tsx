import { RuntimeSettings } from "@ngriffin_uk/polychat-component-account";
import { ProfileTab } from "@ngriffin_uk/polychat-component-shell";
import { useRuntimeEndpoints } from "@ngriffin_uk/polychat-library-react";

export function RuntimeSettingsTab() {
  const { endpoints, isLoading, error, connect, probe, forget } = useRuntimeEndpoints();

  return (
    <ProfileTab
      title="Runtimes"
      description="Connect the model servers this desktop is allowed to reach. Polychat does not scan for them."
    >
      <RuntimeSettings
        endpoints={endpoints}
        isLoading={isLoading}
        loadError={error}
        onConnect={connect.mutateAsync}
        onProbe={probe.mutateAsync}
        onForget={forget.mutateAsync}
      />
    </ProfileTab>
  );
}
