import { usePersonalCapabilityScope } from "../Capabilities/useCapabilityLibraryController.js";
import { PluginsLibrary } from "./PluginsLibrary.js";

export function PluginsPage() {
  const scope = usePersonalCapabilityScope();

  return <PluginsLibrary scope={scope} />;
}
