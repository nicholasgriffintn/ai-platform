import { PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

import { AppRoute } from "~/components/Apps/AppRoute";

export function meta() {
  return [{ title: "App - Polychat" }];
}

export default function ChatAppPage() {
  const { appId = "", "*": subpath = "" } = useParams();

  return <AppRoute surface={PERSONAL_SURFACE} appId={appId} subpath={subpath} />;
}
