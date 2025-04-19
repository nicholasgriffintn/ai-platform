import { useCallback, useEffect, useRef, useState } from "react";

interface AutoscrollOptions {
  threshold?: number;
  behavior?: ScrollBehavior;
  dependency?: any;
}

export const useAutoscroll = ({
  threshold = 200,
  behavior = "smooth",
  dependency,
}: AutoscrollOptions = {}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userHasScrolledRef = useRef(false);
  const prevScrollTopRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollHeight, clientHeight, scrollTop } = container;
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;

    if (scrollTop < prevScrollTopRef.current - 1) {
      userHasScrolledRef.current = true;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }

    if (distanceFromBottom <= threshold) {
      userHasScrolledRef.current = false;
    }

    setShowScrollButton(distanceFromBottom > threshold);
    prevScrollTopRef.current = scrollTop;
  }, [threshold]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: This is intentional
  useEffect(() => {
    userHasScrolledRef.current = false;
    setShowScrollButton(false);

    const container = messagesContainerRef.current;
    if (container) {
      prevScrollTopRef.current = container.scrollTop;
    }
  }, [dependency]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToBottom = useCallback(() => {
    if (userHasScrolledRef.current) return;

    const endElement = messagesEndRef.current;
    if (!endElement) return;

    endElement.scrollIntoView({ behavior });
  }, [behavior]);

  const forceScrollToBottom = useCallback(() => {
    const endElement = messagesEndRef.current;
    if (!endElement) return;

    endElement.scrollIntoView({ behavior });
    userHasScrolledRef.current = false;
    setShowScrollButton(false);
  }, [behavior]);

  // TODO: Put this back when it isn't breaking things
  /* useEffect(() => {
		const observer = new MutationObserver(() => {
			if (userHasScrolledRef.current) return;

			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}

			scrollTimeoutRef.current = setTimeout(() => {
				if (!userHasScrolledRef.current) {
					const endElement = messagesEndRef.current;
					if (endElement) {
						endElement.scrollIntoView({ behavior });
					}
				}
				scrollTimeoutRef.current = null;
			}, 100);
		});

		const container = messagesContainerRef.current;
		if (container) {
			observer.observe(container, {
				childList: true,
				subtree: true,
			});
		}

		return () => {
			observer.disconnect();
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, [behavior]); */

  return {
    messagesEndRef,
    messagesContainerRef,
    scrollToBottom,
    forceScrollToBottom,
    showScrollButton,
  };
};
