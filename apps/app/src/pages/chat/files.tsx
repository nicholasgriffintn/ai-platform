import { useParams } from "react-router";

import { FilesPage } from "~/components/Files/FilesPage";
import { getPlacePaths } from "~/lib/navigation/places";

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
