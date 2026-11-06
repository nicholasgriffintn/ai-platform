import { useMutation } from "@tanstack/react-query";

import { checkMediaFile, checkMediaUrl, type MediaCheckResult } from "../lib/media-check.js";

export function useMediaCheck() {
  return useMutation<MediaCheckResult, Error, Blob | string>({
    mutationFn: (file) => (typeof file === "string" ? checkMediaUrl(file) : checkMediaFile(file)),
  });
}
