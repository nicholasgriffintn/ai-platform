import { getDesktopDownloads } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

export const DESKTOP_DOWNLOADS_QUERY_KEY = ["desktop", "downloads"] as const;

export function useDesktopDownloads() {
  return useQuery({
    queryKey: DESKTOP_DOWNLOADS_QUERY_KEY,
    queryFn: () => getDesktopDownloads(),
    staleTime: 10 * 60 * 1000,
  });
}
