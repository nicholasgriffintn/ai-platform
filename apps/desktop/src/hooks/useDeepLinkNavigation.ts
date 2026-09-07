import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { subscribeToDeepLinks } from "../lib/deep-links";

export function useDeepLinkNavigation() {
  const navigate = useNavigate();

  useEffect(() => subscribeToDeepLinks(listen, (path) => void navigate(path)), [navigate]);
}
