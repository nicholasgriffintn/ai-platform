import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";
import { Navigate } from "react-router";

export default function RootPage() {
  return <Navigate to={MODE_BASE_PATHS.chat} replace />;
}
