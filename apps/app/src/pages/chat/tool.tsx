import { useParams } from "react-router";

import { ToolRunner } from "~/components/Capabilities/ToolRunner";
import { getPlacePaths } from "~/lib/navigation/places";

export function meta() {
  return [{ title: "Run a tool - Polychat" }];
}

export default function PersonalToolPage() {
  const { toolId = "" } = useParams();

  return <ToolRunner backPath={getPlacePaths("chat").teammates} toolId={toolId} />;
}
