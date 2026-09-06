import { useParams } from "react-router";

import { AppRoute } from "~/components/Apps/AppRoute";
import { PERSONAL_SURFACE } from "~/lib/capability-surfaces";

export function meta() {
  return [{ title: "App - Polychat" }];
}

export default function PersonalAppPage() {
  const params = useParams();

  return (
    <AppRoute
      surface={PERSONAL_SURFACE}
      experienceId={params.experienceId ?? ""}
      subpath={params["*"] ?? ""}
    />
  );
}
