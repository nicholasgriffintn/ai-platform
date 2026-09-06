import { CapabilityLibrary } from "~/components/Capabilities/CapabilityLibrary";
import { usePersonalCapabilityScope } from "~/components/Capabilities/useCapabilityLibraryController";

export function meta() {
  return [{ title: "Your capabilities - Polychat" }];
}

export default function PersonalCapabilitiesPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <CapabilityLibrary
      scope={scope}
      title="Teammates &amp; tools"
      subtitle="Teammates, automations, apps and tools that work alongside your conversations."
    />
  );
}
