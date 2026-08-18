import { useEffect, useState, type RefObject } from "react";

const SCROLL_SOURCE_SELECTOR = "[data-header-scroll-source]";
const SHOW_THRESHOLD = 8;
const HIDE_THRESHOLD = 1;

export function useHeaderScrollEdge(
  headerRef: RefObject<HTMLElement | null>,
  resetKey: string,
): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const root = headerRef.current?.parentElement;

    if (!root) {
      return;
    }

    const scrollSources = root.querySelectorAll<HTMLElement>(SCROLL_SOURCE_SELECTOR);

    setIsScrolled(Array.from(scrollSources).some((source) => source.scrollTop > SHOW_THRESHOLD));

    const handleScroll = (event: Event) => {
      const source = event.target;

      if (
        !(source instanceof HTMLElement) ||
        !source.matches(SCROLL_SOURCE_SELECTOR) ||
        !root.contains(source)
      ) {
        return;
      }

      setIsScrolled((current) => source.scrollTop > (current ? HIDE_THRESHOLD : SHOW_THRESHOLD));
    };

    root.addEventListener("scroll", handleScroll, true);

    return () => root.removeEventListener("scroll", handleScroll, true);
  }, [headerRef, resetKey]);

  return isScrolled;
}
