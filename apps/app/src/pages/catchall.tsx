import { NotFoundPage } from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [{ title: "404 - Page Not Found" }, { name: "description", content: "Page not found" }];
}

export default function CatchAllRoute() {
  return <NotFoundPage />;
}
