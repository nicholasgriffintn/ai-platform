import { NotFoundPage } from "@ngriffin_uk/polychat-component-shell";
import { data } from "react-router";

export function meta() {
  return [{ title: "404 - Page Not Found" }, { name: "description", content: "Page not found" }];
}

export function loader() {
  return data(null, { status: 404 });
}

export default function CatchAllRoute() {
  return <NotFoundPage />;
}
