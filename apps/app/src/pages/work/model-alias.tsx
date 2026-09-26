import { AliasView } from "@ngriffin_uk/polychat-component-shell";
import { useParams, useSearchParams } from "react-router";

export function meta() {
  return [{ title: "Alias - Polychat" }];
}

export default function ModelAliasPage() {
  const { workspaceId = "", aliasId = "" } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <AliasView
      workspaceId={workspaceId}
      aliasId={aliasId}
      projectId={searchParams.get("projectId") ?? undefined}
    />
  );
}
