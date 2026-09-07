import { ToolRunner } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopToolPage() {
  const { toolId = "" } = useParams();

  return <ToolRunner backPath={getPlacePaths("chat").teammates} toolId={toolId} />;
}
