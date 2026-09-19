import {
  DEFAULT_SITE_EXPORT_TARGET,
  listSitePages,
  type SiteExportTarget,
  type SiteFile,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";

import type { SiteComponentType } from "../catalog.js";
import { siteThemeClasses, SITE_EXPRESSION_CSS } from "../element-style.js";
import { buildSiteGoogleFontsUrl, renderSiteThemeCss } from "../theme.js";
import { renderSiteStateModule } from "./expressions.js";
import { renderPageFile } from "./page.js";
import {
  renderIconModule,
  renderLinkModule,
  renderUiModule,
  renderUtilsModule,
} from "./support-files.js";
import { SITE_COMPONENT_TEMPLATES } from "./templates.js";

const TARGET_LABELS: Record<SiteExportTarget, string> = {
  "react-router": "React Router",
  next: "Next.js",
  "tanstack-router": "TanStack Router",
};

function packageJson(target: SiteExportTarget): Record<string, unknown> {
  const sharedDependencies = {
    clsx: "^2.1.1",
    "lucide-react": "^1.45.0",
    react: "^19.3.0",
    "react-dom": "^19.3.0",
    "tailwind-merge": "^3.6.0",
  };
  const sharedDevDependencies = {
    "@types/node": "^26.5.1",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    tailwindcss: "^4.3.3",
    typescript: "^6.0.3",
  };

  if (target === "next") {
    return {
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { ...sharedDependencies, next: "^16.3.5" },
      devDependencies: {
        ...sharedDevDependencies,
        "@tailwindcss/postcss": "^4.3.3",
      },
    };
  }

  if (target === "tanstack-router") {
    return {
      private: true,
      type: "module",
      scripts: { dev: "vite", build: "vite build && tsc --noEmit", preview: "vite preview" },
      dependencies: {
        ...sharedDependencies,
        "@tanstack/react-router": "^1.170.38",
      },
      devDependencies: {
        ...sharedDevDependencies,
        "@tailwindcss/vite": "^4.3.3",
        "@tanstack/router-plugin": "^1.168.40",
        "@vitejs/plugin-react": "^6.1.1",
        vite: "^8.3.0",
      },
    };
  }

  return {
    private: true,
    type: "module",
    scripts: {
      dev: "react-router dev",
      build: "react-router build",
      start: "react-router-serve ./build/server/index.js",
      typecheck: "react-router typegen && tsc --noEmit",
    },
    dependencies: {
      ...sharedDependencies,
      "@react-router/node": "^8.3.1",
      "@react-router/serve": "^8.3.1",
      isbot: "^5.2.2",
      "react-router": "^8.3.1",
    },
    devDependencies: {
      ...sharedDevDependencies,
      "@react-router/dev": "^8.3.1",
      "@tailwindcss/vite": "^4.3.3",
      vite: "^8.3.0",
    },
  };
}

function tsconfig(target: SiteExportTarget): Record<string, unknown> {
  const sourceRoot = target === "next" ? "." : target === "react-router" ? "./app" : "./src";

  return {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "react-jsx",
      ...(target === "next" ? { plugins: [{ name: "next" }] } : {}),
      paths: { "@/*": [`${sourceRoot}/*`] },
    },
    include:
      target === "next"
        ? ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
        : ["**/*.ts", "**/*.tsx"],
    exclude: ["node_modules", "build", "dist"],
  };
}

function renderGlobalsCss(project: SiteProject): string {
  return `@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

${renderSiteThemeCss(project.theme)}

${SITE_EXPRESSION_CSS}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: var(--font-sans);
  --font-heading: var(--font-heading);
}

@layer base {
  :where(*), ::before, ::after {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
`;
}

function documentClasses(project: SiteProject): string {
  return [project.theme.mode === "dark" ? "dark" : "", siteThemeClasses(project.theme)]
    .filter(Boolean)
    .join(" ");
}

function renderNextLayout(project: SiteProject): string {
  const description = project.description ?? project.title;

  return `import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: ${JSON.stringify(project.title)}, template: ${JSON.stringify(`%s · ${project.title}`)} },
  description: ${JSON.stringify(description)},
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className=${JSON.stringify(documentClasses(project))}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href=${JSON.stringify(buildSiteGoogleFontsUrl(project.theme.font))} />
      </head>
      <body>{children}</body>
    </html>
  );
}
`;
}

function renderReactRouterRoot(project: SiteProject): string {
  return `import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import "./globals.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className=${JSON.stringify(documentClasses(project))}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href=${JSON.stringify(buildSiteGoogleFontsUrl(project.theme.font))} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
`;
}

function renderReactRouterRoutes(project: SiteProject): string {
  const routes = listSitePages(project).map(({ page }) => {
    const segments = page.path.split("/").filter(Boolean);
    const file = segments.length ? `routes/${segments.join(".")}.tsx` : "routes/home.tsx";

    return segments.length
      ? `  route(${JSON.stringify(segments.join("/"))}, ${JSON.stringify(file)}),`
      : `  index(${JSON.stringify(file)}),`;
  });

  return `import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
${routes.join("\n")}
] satisfies RouteConfig;
`;
}

function renderTanStackRoot(project: SiteProject): string {
  return `import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({ component: RootComponent });

function RootComponent() {
  return (
    <div className=${JSON.stringify(`min-h-screen ${documentClasses(project)}`)}>
      <Outlet />
    </div>
  );
}
`;
}

function renderTanStackMain(): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import "./globals.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
`;
}

function renderViteConfig(target: SiteExportTarget): string {
  if (target === "react-router") {
    return `import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
`;
  }

  return `import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
`;
}

function renderReadme(
  project: SiteProject,
  components: SiteComponentType[],
  target: SiteExportTarget,
): string {
  const pages = listSitePages(project)
    .map(({ page }) => `- \`${page.path}\` — ${page.title}`)
    .join("\n");
  const sourceRoot = target === "next" ? "" : target === "react-router" ? "app/" : "src/";

  return `# ${project.title}

${project.description ?? ""}

Generated by Polychat Sites as a ${TARGET_LABELS[target]} application with Tailwind CSS v4. The project is editable, portable, and ready to extend beyond the generated experience.

## Run

\`\`\`sh
npm install
npm run dev
\`\`\`

## Pages

${pages}

## Components

${components.map((component) => `- \`${sourceRoot}components/site/${component}.tsx\``).join("\n")}

Theme tokens and expressive design settings live in \`${sourceRoot}${target === "next" ? "app/" : ""}globals.css\`.
`;
}

function frameworkFiles(project: SiteProject, target: SiteExportTarget): SiteFile[] {
  if (target === "next") {
    return [
      {
        path: "next.config.ts",
        content:
          'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n',
      },
      {
        path: "postcss.config.mjs",
        content: 'export default { plugins: { "@tailwindcss/postcss": {} } };\n',
      },
      { path: "app/globals.css", content: renderGlobalsCss(project) },
      { path: "app/layout.tsx", content: renderNextLayout(project) },
    ];
  }

  if (target === "tanstack-router") {
    return [
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.title.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href=${JSON.stringify(buildSiteGoogleFontsUrl(project.theme.font))} />
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`,
      },
      { path: "vite.config.ts", content: renderViteConfig(target) },
      { path: "src/globals.css", content: renderGlobalsCss(project) },
      { path: "src/vite-env.d.ts", content: '/// <reference types="vite/client" />\n' },
      { path: "src/main.tsx", content: renderTanStackMain() },
      { path: "src/routes/__root.tsx", content: renderTanStackRoot(project) },
    ];
  }

  return [
    {
      path: "react-router.config.ts",
      content:
        'import type { Config } from "@react-router/dev/config";\n\nexport default { ssr: true } satisfies Config;\n',
    },
    { path: "vite.config.ts", content: renderViteConfig(target) },
    { path: "app/globals.css", content: renderGlobalsCss(project) },
    { path: "app/root.tsx", content: renderReactRouterRoot(project) },
    { path: "app/routes.ts", content: renderReactRouterRoutes(project) },
  ];
}

function sourcePath(target: SiteExportTarget, path: string): string {
  if (target === "next") {
    return path;
  }

  return `${target === "react-router" ? "app" : "src"}/${path}`;
}

function componentTemplate(component: SiteComponentType): string {
  return SITE_COMPONENT_TEMPLATES[component].replaceAll(
    'from "next/link"',
    'from "@/components/site/link"',
  );
}

export interface GeneratedSiteFiles {
  target: SiteExportTarget;
  files: SiteFile[];
  components: SiteComponentType[];
}

export function generateSiteFiles(
  project: SiteProject,
  target: SiteExportTarget = DEFAULT_SITE_EXPORT_TARGET,
): GeneratedSiteFiles {
  const pages = listSitePages(project);
  const used = new Set<SiteComponentType>();
  const pageFiles: SiteFile[] = [];
  let usesState = false;

  for (const { page } of pages) {
    const rendered = renderPageFile(page, target);

    usesState = usesState || rendered.usesState;
    pageFiles.push({ path: rendered.path, content: rendered.content });

    for (const component of rendered.components) {
      used.add(component);
    }
  }

  const components = [...used].sort();
  const componentFiles = components.map((component) => ({
    path: sourcePath(target, `components/site/${component}.tsx`),
    content: componentTemplate(component),
  }));
  const files: SiteFile[] = [
    { path: "README.md", content: renderReadme(project, components, target) },
    { path: "package.json", content: `${JSON.stringify(packageJson(target), null, 2)}\n` },
    { path: "tsconfig.json", content: `${JSON.stringify(tsconfig(target), null, 2)}\n` },
    ...frameworkFiles(project, target),
    ...pageFiles,
    { path: sourcePath(target, "lib/utils.ts"), content: renderUtilsModule() },
    ...(usesState
      ? [
          {
            path: sourcePath(target, "lib/site-state.ts"),
            content: renderSiteStateModule(),
          },
        ]
      : []),
    { path: sourcePath(target, "components/site/icon.tsx"), content: renderIconModule() },
    { path: sourcePath(target, "components/site/link.tsx"), content: renderLinkModule(target) },
    { path: sourcePath(target, "components/site/ui.tsx"), content: renderUiModule() },
    ...componentFiles,
  ];

  return { target, files, components };
}
