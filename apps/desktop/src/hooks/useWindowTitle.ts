import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { useLocation } from "react-router";

import { describeWindowTitle } from "../lib/window-title";
import { readPageForPath } from "../route-definitions";

export function useWindowTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = describeWindowTitle(readPageForPath(pathname));

    document.title = title;
    void getCurrentWindow()
      .setTitle(title)
      .catch(() => undefined);
  }, [pathname]);
}
