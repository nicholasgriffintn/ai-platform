import { AdminApp } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Admin - Polychat" }, { name: "robots", content: "noindex" }];
}

export default function AdminPage() {
  const { "*": subpath = "" } = useParams();

  return <AdminApp subpath={subpath} />;
}
