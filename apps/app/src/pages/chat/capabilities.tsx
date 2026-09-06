import { Navigate } from "react-router";

import { PLACE_PATHS } from "~/lib/navigation/places";

export default function PersonalCapabilitiesPage() {
  return <Navigate to={PLACE_PATHS.library} replace />;
}
