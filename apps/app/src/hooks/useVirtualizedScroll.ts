"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVirtualizedScrollProps {
  dependency?: string | null;
  threshold?: number;
}

export function useVirtualizedScroll({
  dependency,
  threshold = 100,
}: UseVirtualizedScrollProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const checkScrollPosition = useCallback(() => {
    if (!containerRef.current) return;

    try {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setShowScrollButton(distanceFromBottom > threshold);
    } catch (error) {
      console.error("Error checking scroll position:", error);
    }
  }, [threshold]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;

    try {
      const scrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTo({
        top: scrollHeight,
        behavior,
      });
    } catch (error) {
      console.error("Error scrolling to bottom:", error);
    }
  }, []);

  const forceScrollToBottom = useCallback(() => {
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  // Set up scroll event listener
  useEffect(() => {
    const currentRef = containerRef.current;
    if (currentRef) {
      currentRef.addEventListener("scroll", checkScrollPosition);
      return () => {
        currentRef.removeEventListener("scroll", checkScrollPosition);
      };
    }
  }, [checkScrollPosition]);

  // Scroll to bottom when dependency changes
  useEffect(() => {
    if (dependency) {
      scrollToBottom("auto");
      checkScrollPosition();
    }
  }, [dependency, scrollToBottom, checkScrollPosition]);

  return {
    containerRef,
    showScrollButton,
    scrollToBottom,
    forceScrollToBottom,
    checkScrollPosition,
  };
}
