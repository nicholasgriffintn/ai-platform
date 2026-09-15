import { CapabilityLibrary } from "../Capabilities/CapabilityLibrary.js";
import {
  PLUGIN_LIBRARY_KINDS,
  type CapabilityLibraryScope,
} from "../Capabilities/useCapabilityLibraryController.js";
import { PluginsIntegrationsSection } from "./PluginsIntegrationsSection.js";

export function PluginsLibrary({
  scope,
  projectName,
}: {
  scope: CapabilityLibraryScope;
  projectName?: string;
}) {
  return (
    <CapabilityLibrary
      scope={scope}
      kinds={PLUGIN_LIBRARY_KINDS}
      title="Plugins"
      subtitle={
        projectName
          ? `The apps, skills and tools ${projectName} can use, and the accounts they can reach.`
          : "The apps, skills and tools Polychat can use on your behalf, and the accounts they can reach."
      }
    >
      <PluginsIntegrationsSection />
    </CapabilityLibrary>
  );
}
