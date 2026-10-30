import { DISCOVER_PATH } from "@ngriffin_uk/polychat-library-react";
import { redirect } from "react-router";

export function loader() {
  return redirect(DISCOVER_PATH);
}

export function clientLoader() {
  return redirect(DISCOVER_PATH);
}

export default function Discover() {
  return null;
}
