import { memo, useEffect, useMemo, useRef } from "react";

import { markdownToHtml } from "~/lib/markdown";

interface TemplateViewProps {
  template?: string;
  data: Record<string, any>;
}

const getNestedValue = (obj: Record<string, any>, path: string): any => {
  const keys = path.split(".");
  return keys.reduce(
    (o, key) => (o && o[key] !== undefined ? o[key] : undefined),
    obj,
  );
};

const variableRegex = /\{\{([^}]+)\}\}/g;
const ifRegex =
  /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
const thisPropertyRegex = /\{\{this\.([^}]+)\}\}/g;
const thisValueRegex = /\{\{this\}\}/g;
const markdownRegex = /\{\{md\s+([^}]+)\}\}/g;

const processVariable = (data: Record<string, any>, key: string): string => {
  const trimmedKey = key.trim();
  const value = getNestedValue(data, trimmedKey);

  if (value === undefined || value === null) {
    return "";
  }

  if (trimmedKey.includes("date") && value instanceof Date) {
    return value.toLocaleDateString();
  }

  if (trimmedKey.includes("price") || trimmedKey.includes("amount")) {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num);
    }
  }

  return String(value);
};

const renderTemplate = (
  template: string,
  data: Record<string, any>,
): string => {
  let rendered = template;

  rendered = rendered.replace(eachRegex, (_match, arrayKey, content) => {
    const trimmedKey = arrayKey.trim();
    const array = getNestedValue(data, trimmedKey);

    if (!Array.isArray(array)) {
      return "";
    }

    return array
      .map((item) => {
        let itemContent = content;

        if (typeof item === "object") {
          itemContent = itemContent.replace(
            thisPropertyRegex,
            (_match: string, prop: string) => {
              const value = item[prop.trim()];
              return value !== undefined ? String(value) : "";
            },
          );
        } else {
          itemContent = itemContent.replace(thisValueRegex, String(item));
        }

        return itemContent;
      })
      .join("");
  });

  rendered = rendered.replace(
    ifRegex,
    (_match, condition, ifContent, elseContent = "") => {
      const trimmedCondition = condition.trim();
      const value = getNestedValue(data, trimmedCondition);
      return value ? ifContent : elseContent;
    },
  );

  rendered = rendered.replace(markdownRegex, (_match, key) => {
    const trimmedKey = key.trim();
    const value = getNestedValue(data, trimmedKey);

    if (value === undefined || value === null) {
      return "";
    }

    return markdownToHtml(String(value));
  });

  rendered = rendered.replace(variableRegex, (_match, key) => {
    return processVariable(data, key);
  });

  return rendered;
};

export const TemplateView = memo(({ template, data }: TemplateViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderedHtml = useMemo(() => {
    if (!template) return null;

    try {
      return renderTemplate(template, data);
    } catch (error) {
      console.error("Error rendering template:", error);
      return `
        <div class="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md border border-red-300 dark:border-red-800">
          <h3 class="font-semibold">Error rendering template</h3>
          <p>${error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      `;
    }
  }, [template, data]);

  useEffect(() => {
    if (!renderedHtml || !containerRef.current) {
      return;
    }

    containerRef.current.innerHTML = renderedHtml;

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [renderedHtml]);

  if (!template) {
    return (
      <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
        No response is available.
      </div>
    );
  }

  return (
    <div
      className="custom-template text-zinc-900 dark:text-zinc-100"
      ref={containerRef}
    />
  );
});
