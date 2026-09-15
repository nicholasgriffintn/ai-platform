import {
  CapabilityLibrary,
  TEAMMATE_LIBRARY_KINDS,
  usePersonalCapabilityScope,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopTeammatesPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <CapabilityLibrary
      scope={scope}
      kinds={TEAMMATE_LIBRARY_KINDS}
      title="Teammates"
      subtitle="The teammates you have hired."
    />
  );
}
