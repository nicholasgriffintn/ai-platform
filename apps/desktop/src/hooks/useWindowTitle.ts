import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { useLocation } from "react-router";

import { isDesktopRuntime } from "../infrastructure/desktop-runtime";
import { describeWindowTitle } from "../infrastructure/window-title";
import { readPageForPath } from "../route-definitions";

function setNativeWindowTitle(title: string) {
  if (!isDesktopRuntime()) {
    return;
  }

  try {
    void getCurrentWindow()
      .setTitle(title)
      .catch(() => undefined);
  } catch {
    return;
  }
}

export function useWindowTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = describeWindowTitle(readPageForPath(pathname));

    document.title = title;
    setNativeWindowTitle(title);
  }, [pathname]);
}
