import { useParams } from "react-router";

import { ToolRunner } from "~/components/Capabilities/ToolRunner";
import { PLACE_PATHS } from "~/lib/navigation/places";

export function meta() {
  return [{ title: "Run a tool - Polychat" }];
}

export default function PersonalToolPage() {
  const { toolId = "" } = useParams();

  return <ToolRunner backPath={PLACE_PATHS.library} toolId={toolId} />;
}
