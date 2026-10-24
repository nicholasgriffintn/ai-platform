import { readSourceCitationId, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { MouseEvent } from "react";

export function useSourceCitationClick() {
  const setOpenFile = useUIStore((state) => state.setOpenFile);

  return (event: MouseEvent<HTMLElement>) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    const sourceId = readSourceCitationId(link?.getAttribute("href"));

    if (!sourceId) {
      return;
    }

    event.preventDefault();
    setOpenFile({ origin: "source", id: sourceId });
  };
}
