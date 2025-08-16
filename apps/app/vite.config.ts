import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ isSsrBuild, command }) => ({
  build: {
    rollupOptions: isSsrBuild
      ? {
          input: "./workers/app.ts",
        }
      : {
          output: {
            manualChunks: {
              // Split vendor libraries into separate chunks
              'react-vendor': ['react', 'react-dom'],
              'router-vendor': ['react-router'],
              'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
              'query-vendor': ['@tanstack/react-query'],
              'markdown-vendor': ['react-markdown', 'rehype-highlight', 'remark-gfm'],
              'icons-vendor': ['lucide-react'],
            },
          },
        },
    sourcemap: command === 'build' ? false : true, // Enable sourcemaps only in dev
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: command === 'build', // Remove console.log in production
        drop_debugger: true,
      },
    },
  },
  plugins: [
    babel({
      filter: /\.tsx?$/,
      babelConfig: {
        presets: ["@babel/preset-typescript"],
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    cloudflareDevProxy({
      getLoadContext({ context }) {
        return { cloudflare: context.cloudflare };
      },
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    // Add bundle analyzer in development
    command === 'build' && visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router',
      '@tanstack/react-query',
      'zustand',
      'lucide-react',
    ],
  },
}));
