import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = import.meta.dirname;

const skillMarkdown = {
  name: "skill-markdown",
  enforce: "pre",
  async load(id) {
    if (!id.endsWith(".md")) {
      return null;
    }

    return `export default ${JSON.stringify(await readFile(id, "utf8"))};`;
  },
};

export function apiTestProject({ name, include, isolate }) {
  return {
    plugins: [skillMarkdown],
    resolve: {
      alias: {
        "~": path.resolve(projectRoot, "./src"),
      },
    },
    test: {
      name,
      environment: "node",
      pool: "threads",
      isolate,
      include,
    },
  };
}
