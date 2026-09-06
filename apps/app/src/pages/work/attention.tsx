import { Navigate, useLocation } from "react-router";

import { PLACE_PATHS } from "~/lib/navigation/places";

export default function WorkAttentionPage() {
  const { search } = useLocation();

  return <Navigate to={`${PLACE_PATHS.attention}${search}`} replace />;
}
