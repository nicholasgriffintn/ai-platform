import { WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { Outlet } from "react-router";

export default function WorkLayout() {
  return (
    <WorkPlaceShell>
      <Outlet />
    </WorkPlaceShell>
  );
}
