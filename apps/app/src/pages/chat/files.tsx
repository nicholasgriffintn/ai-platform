import { FilesPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [
    { title: "Files - Polychat" },
    { name: "description", content: "Everything you have given Polychat and everything it made." },
  ];
}

export default function ChatFilesPage() {
  const { "*": subpath = "" } = useParams();

  return <FilesPage basePath={getPlacePaths("chat").files} subpath={subpath} />;
}
