import { ChatPlaceShell, FilesPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopFilesPage() {
  const { "*": subpath = "" } = useParams();

  return (
    <ChatPlaceShell>
      <FilesPage basePath={getPlacePaths("chat").files} subpath={subpath} />
    </ChatPlaceShell>
  );
}
