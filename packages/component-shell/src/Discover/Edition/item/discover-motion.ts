export const DISCOVER_EASE = "cubic-bezier(.2,.8,.2,1)";
export const PANEL_OPEN_MS = 360;
export const PANEL_CLOSE_MS = 260;
export const REDUCED_FADE_MS = 120;
const MORPH_MS = 460;
const MORPH_MAX_AGE_MS = 700;
const OPEN_STAGGER = { delay: 160, step: 45, duration: 320 };
const SWITCH_STAGGER = { delay: 0, step: 30, duration: 180 };
const COMPOSER_RISE = { delay: 300, duration: 320 };

export type DiscoverEntrance = "open" | "switch";

export interface DiscoverMorphSource {
  key: string;
  rect: DOMRect;
  art: HTMLElement;
  at: number;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function captureDiscoverMorph(host: Element | null): DiscoverMorphSource | null {
  const key = host?.getAttribute("data-discover-item");
  const art = host?.querySelector("[data-discover-art]");

  if (!key || !(art instanceof HTMLElement)) {
    return null;
  }

  const clone = art.cloneNode(true);

  return clone instanceof HTMLElement
    ? { key, rect: art.getBoundingClientRect(), art: clone, at: performance.now() }
    : null;
}

function finalTargetRect(target: HTMLElement, panel: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const host = panel.parentElement?.getBoundingClientRect();
  const offset = host ? host.right - panelRect.width - panelRect.left : 0;

  return { x: rect.left + offset, y: rect.top, width: rect.width, height: rect.height };
}

export function playDiscoverMorph(
  source: DiscoverMorphSource,
  target: HTMLElement,
  panel: HTMLElement,
) {
  if (performance.now() - source.at > MORPH_MAX_AGE_MS || prefersReducedMotion()) {
    return;
  }

  const to = finalTargetRect(target, panel);
  const from = source.rect;
  const ghost = document.createElement("div");

  Object.assign(ghost.style, {
    position: "fixed",
    left: "0",
    top: "0",
    overflow: "hidden",
    borderRadius: "16px",
    zIndex: "60",
    pointerEvents: "none",
    boxShadow: "0 20px 60px rgb(0 0 0 / 0.45)",
  });
  ghost.setAttribute("aria-hidden", "true");
  ghost.append(source.art);
  document.body.append(ghost);

  const frame = (rect: { x: number; y: number; width: number; height: number }) => ({
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  const animation = ghost.animate(
    [
      { ...frame(from), opacity: 1, easing: DISCOVER_EASE },
      { ...frame(to), opacity: 1, offset: 0.8, easing: "ease-out" },
      { ...frame(to), opacity: 0 },
    ],
    { duration: MORPH_MS, fill: "forwards" },
  );

  const remove = () => ghost.remove();

  animation.addEventListener("finish", remove);
  animation.addEventListener("cancel", remove);
}

export function playDiscoverEntrance(
  root: HTMLElement,
  entrance: DiscoverEntrance,
  startedAt: number,
) {
  if (prefersReducedMotion()) {
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE_MS, easing: "linear" });

    return;
  }

  const timing = entrance === "open" ? OPEN_STAGGER : SWITCH_STAGGER;
  const elapsed = entrance === "open" ? performance.now() - startedAt : 0;
  const offset = Math.max(0, timing.delay - elapsed);
  const rise = [
    { opacity: 0, transform: "translateY(10px)" },
    { opacity: 1, transform: "none" },
  ];

  root.querySelectorAll("[data-stagger], [data-welcome-starters]").forEach((element, index) => {
    element.animate(rise, {
      duration: timing.duration,
      delay: offset + index * timing.step,
      easing: DISCOVER_EASE,
      fill: "backwards",
    });
  });

  root.querySelector("[data-chat-input-shell]")?.animate(rise, {
    duration: entrance === "open" ? COMPOSER_RISE.duration : timing.duration,
    delay: entrance === "open" ? Math.max(0, COMPOSER_RISE.delay - elapsed) : offset,
    easing: DISCOVER_EASE,
    fill: "backwards",
  });
}

export function riseIn(element: HTMLElement | null) {
  if (!element || prefersReducedMotion()) {
    return;
  }

  element.animate(
    [
      { opacity: 0, transform: "translateY(-6px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 220, easing: DISCOVER_EASE },
  );
}

export function slideInPanel(element: HTMLElement | null) {
  if (!element || prefersReducedMotion()) {
    return;
  }

  element.animate(
    [
      { opacity: 0, transform: "translateX(24px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: PANEL_OPEN_MS, easing: DISCOVER_EASE },
  );
}
