import { CapabilityLibrary } from "~/components/Capabilities/CapabilityLibrary";
import { usePersonalCapabilityScope } from "~/components/Capabilities/useCapabilityLibraryController";

export function meta() {
  return [{ title: "Teammates - Polychat" }];
}

export default function ChatTeammatesPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <CapabilityLibrary
      scope={scope}
      title="Teammates"
      subtitle="The teammates you have hired, and the apps, automations and tools they work with."
    />
  );
}
