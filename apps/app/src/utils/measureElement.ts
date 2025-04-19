function measureElement(element: unknown): number {
  // Default height if element is invalid
  const defaultHeight = 150;

  // Check if element is valid
  if (!element) return defaultHeight;

  try {
    // Make sure element is an HTMLElement before calling getBoundingClientRect
    if (element instanceof HTMLElement) {
      const { height } = element.getBoundingClientRect();
      return height > 0 ? height : defaultHeight;
    }

    // If it's a React ref object, try to access current
    if (
      typeof element === "object" &&
      "current" in element &&
      element.current instanceof HTMLElement
    ) {
      const { height } = element.current.getBoundingClientRect();
      return height > 0 ? height : defaultHeight;
    }
  } catch (error) {
    console.error("Error measuring element:", error);
  }

  return defaultHeight;
}

export default measureElement;
