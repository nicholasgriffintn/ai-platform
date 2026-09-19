import { cn } from "@ngriffin_uk/polychat-component-ui";
import { buildSiteThemeVariables } from "@ngriffin_uk/polychat-library-sites";
import type { SiteTheme } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const STYLE_SELECTOR = 'link[rel="stylesheet"], style';
const MIRRORED_ATTRIBUTE = "data-site-frame-source";

function mirrorStyles(source: Document, target: Document): void {
  const mirrored = new Set(
    [...target.head.querySelectorAll(`[${MIRRORED_ATTRIBUTE}]`)].map((node) =>
      node.getAttribute(MIRRORED_ATTRIBUTE),
    ),
  );

  source.head.querySelectorAll(STYLE_SELECTOR).forEach((node, index) => {
    const id =
      node.id || node.getAttribute("href") || `inline-${index}-${node.textContent?.length ?? 0}`;

    if (mirrored.has(id)) {
      return;
    }

    const clone = target.importNode(node, true);

    clone.setAttribute(MIRRORED_ATTRIBUTE, id);
    target.head.append(clone);
  });
}

function applyTheme(target: Document, theme: SiteTheme): void {
  const root = target.documentElement;

  for (const [name, value] of Object.entries(buildSiteThemeVariables(theme))) {
    root.style.setProperty(name, value);
  }

  root.classList.toggle("dark", theme.mode === "dark");
  root.dataset.siteMode = theme.mode;
}

export interface SiteFrameProps {
  theme: SiteTheme;
  width: string;
  title: string;
  className?: string;
  children: ReactNode;
}

export function SiteFrame({ theme, width, title, className, children }: SiteFrameProps) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const target = frame?.contentDocument;

    if (!frame || !target) {
      return undefined;
    }

    const prepare = () => {
      const doc = frame.contentDocument;

      if (!doc?.body) {
        return;
      }

      mirrorStyles(document, doc);
      doc.body.dataset.sitePreview = "";
      doc.body.className = "min-h-screen bg-background font-sans text-foreground antialiased";

      let root = doc.getElementById("site-root");

      if (!root) {
        root = doc.createElement("div");
        root.id = "site-root";
        doc.body.append(root);
      }

      setMount(root);
    };

    prepare();

    const observer = new MutationObserver(() => {
      if (frame.contentDocument) {
        mirrorStyles(document, frame.contentDocument);
      }
    });

    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    frame.addEventListener("load", prepare);

    return () => {
      observer.disconnect();
      frame.removeEventListener("load", prepare);
    };
  }, [frame]);

  useEffect(() => {
    if (frame?.contentDocument && mount) {
      applyTheme(frame.contentDocument, theme);
    }
  }, [frame, mount, theme]);

  return (
    <iframe
      ref={setFrame}
      title={title}
      sandbox="allow-same-origin"
      style={{ width, maxWidth: "100%" }}
      className={cn("block h-full min-h-full shrink-0 border-0 bg-background", className)}
    >
      {mount ? createPortal(children, mount) : null}
    </iframe>
  );
}
