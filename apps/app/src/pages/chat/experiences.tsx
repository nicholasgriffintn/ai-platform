import { AppsPage } from "~/components/Apps/AppsPage";
import { PERSONAL_SURFACE } from "~/lib/capability-surfaces";

export function meta() {
  return [{ title: "Apps - Polychat" }];
}

export default function PersonalAppsPage() {
  return <AppsPage surface={PERSONAL_SURFACE} />;
}
