import type { Plugin } from "vite";

const LEADING_SLASHES = /^[/\\]+/u;

export function collapseLeadingSlashes(): Plugin {
  return {
    name: "polychat-collapse-leading-slashes",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("//")) {
          next();

          return;
        }

        res.writeHead(308, { Location: req.url.replace(LEADING_SLASHES, "/") });
        res.end();
      });
    },
  };
}
