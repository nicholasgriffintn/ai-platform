import { useEffect, useState } from "react";
import type { Options } from "react-markdown";

type RehypePlugins = NonNullable<Options["rehypePlugins"]>;

const CODE_FENCE_PATTERN = /```|~~~/;

let loadedPlugins: RehypePlugins | undefined;
let pendingPlugins: Promise<RehypePlugins> | undefined;

function loadPlugins(): Promise<RehypePlugins> {
  pendingPlugins ??= import("rehype-highlight").then(({ default: rehypeHighlight }) => {
    loadedPlugins = [() => rehypeHighlight({ detect: false })];

    return loadedPlugins;
  });

  return pendingPlugins;
}

export function useCodeHighlightPlugins(markdown: string): RehypePlugins | undefined {
  const [plugins, setPlugins] = useState(loadedPlugins);
  const hasCodeFence = CODE_FENCE_PATTERN.test(markdown);

  useEffect(() => {
    if (plugins || !hasCodeFence) {
      return undefined;
    }

    let isCurrent = true;

    const applyPlugins = async () => {
      try {
        const nextPlugins = await loadPlugins();

        if (isCurrent) {
          setPlugins(nextPlugins);
        }
      } catch {
        pendingPlugins = undefined;
      }
    };

    void applyPlugins();

    return () => {
      isCurrent = false;
    };
  }, [hasCodeFence, plugins]);

  return plugins;
}
