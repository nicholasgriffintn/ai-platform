import {
  CapabilityLibrary,
  ChatPlaceShell,
  usePersonalCapabilityScope,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopTeammatesPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <ChatPlaceShell>
      <CapabilityLibrary
        scope={scope}
        title="Teammates"
        subtitle="The teammates you have hired, and the apps, automations and tools they work with."
      />
    </ChatPlaceShell>
  );
}
