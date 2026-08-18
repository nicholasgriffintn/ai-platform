if (!("window" in globalThis)) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
}
