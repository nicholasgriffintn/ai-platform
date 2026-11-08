import { usePersonalCapabilityScope } from "../Capabilities/useCapabilityLibraryController.js";
import { PluginsLibrary } from "./PluginsLibrary.js";
import { RemoteAppsSection } from "./RemoteAppsSection.js";

export function PluginsPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <PluginsLibrary scope={scope}>
      <RemoteAppsSection />
    </PluginsLibrary>
  );
}
