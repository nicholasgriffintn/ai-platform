import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

import { ToolRunner } from "~/components/Capabilities/ToolRunner";

export function meta() {
  return [{ title: "Run a tool - Polychat" }];
}

export default function PersonalToolPage() {
  const { toolId = "" } = useParams();

  return <ToolRunner backPath={getPlacePaths("chat").teammates} toolId={toolId} />;
}
