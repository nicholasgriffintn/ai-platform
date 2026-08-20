import { memo, useEffect, useMemo, useRef } from "react";

import { escapeHtml, markdownToHtml } from "./markdown-to-html";

interface TemplateViewProps {
  template?: string;
  data: Record<string, any>;
}

const getNestedValue = (obj: Record<string, any>, path: string): any => {
  const keys = path.split(".");
  let startIndex = 0;
  const base = obj;

  if (keys[0] === "data" && (obj.data === undefined || obj.data === obj)) {
    startIndex = 1;
  }

  return keys
    .slice(startIndex)
    .reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), base);
};

const variableRegex = /\{\{([^}]+)\}\}/g;
const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
const thisPropertyRegex = /\{\{this\.([^}]+)\}\}/g;
const thisValueRegex = /\{\{this\}\}/g;
const markdownRegex = /\{\{md\s+([^}]+)\}\}/g;
const jsonRegex = /\{\{json\s+([^}]+)\}\}/g;

/**
 * Templates are authored by the tool schema, but the values interpolated into them come from web
 * pages, third-party APIs and MCP servers. Every value crossing into the rendered HTML is escaped;
 * only `{{md …}}`, which runs through the escaping markdown converter, may emit markup.
 */
const formatVariable = (data: Record<string, any>, key: string): string => {
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

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const processVariable = (data: Record<string, any>, key: string): string =>
  escapeHtml(formatVariable(data, key));

const renderTemplate = (template: string, data: Record<string, any>): string => {
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
            (_itemMatch: string, prop: string) => {
              const value = item[prop.trim()];

              return value !== undefined ? escapeHtml(String(value)) : "";
            },
          );
        } else {
          itemContent = itemContent.replace(thisValueRegex, () => escapeHtml(String(item)));
        }

        return itemContent;
      })
      .join("");
  });

  rendered = rendered.replace(ifRegex, (_match, condition, ifContent, elseContent = "") => {
    const trimmedCondition = condition.trim();
    const value = getNestedValue(data, trimmedCondition);

    return value ? ifContent : elseContent;
  });

  rendered = rendered.replace(jsonRegex, (_match, key) => {
    const value = getNestedValue(data, key.trim());

    if (value === undefined || value === null) {
      return "";
    }

    return escapeHtml(JSON.stringify(value, null, 2));
  });

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

  const rendered = useMemo((): { html: string } | { error: string } | null => {
    if (!template) {
      return null;
    }

    try {
      return { html: renderTemplate(template, data) };
    } catch (error) {
      console.error("Error rendering template:", error);

      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, [template, data]);

  const html = rendered && "html" in rendered ? rendered.html : null;

  useEffect(() => {
    const container = containerRef.current;

    if (html === null || !container) {
      return undefined;
    }

    container.innerHTML = html;

    return () => {
      container.innerHTML = "";
    };
  }, [html]);

  if (!template) {
    return (
      <div
        data-responsetype="template"
        className="rounded-md border border-amber-200 bg-amber-100 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      >
        No response is available.
      </div>
    );
  }

  if (rendered && "error" in rendered) {
    return (
      <div
        data-responsetype="template"
        className="rounded-md border border-red-300 bg-red-100 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
      >
        <h3 className="font-semibold">Error rendering template</h3>
        <p>{rendered.error}</p>
      </div>
    );
  }

  return (
    <div
      data-responsetype="template"
      className="custom-template prose prose-sm prose-zinc max-w-none text-zinc-900 dark:prose-invert dark:text-zinc-100"
      ref={containerRef}
    />
  );
});
