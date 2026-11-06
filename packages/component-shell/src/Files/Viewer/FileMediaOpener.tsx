import {
  MediaOpenerProvider,
  type MediaOpenRequest,
} from "@ngriffin_uk/polychat-component-content";
import { fileTargetForMedia, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { type ReactNode, useCallback } from "react";

export function FileMediaOpener({ children }: { children: ReactNode }) {
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const open = useCallback(
    ({ src, alt, downloadHref, crossOrigin }: MediaOpenRequest) =>
      setOpenFile(fileTargetForMedia({ url: src, title: alt, downloadHref, crossOrigin })),
    [setOpenFile],
  );

  return <MediaOpenerProvider onOpen={open}>{children}</MediaOpenerProvider>;
}
