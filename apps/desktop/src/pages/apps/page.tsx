import { AppRoute } from "@ngriffin_uk/polychat-component-shell";
import { PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopAppPage() {
  const { appId = "", "*": subpath = "" } = useParams();

  return <AppRoute appId={appId} subpath={subpath} surface={PERSONAL_SURFACE} />;
}
