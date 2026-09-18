import {
  DEFAULT_EXPORT_BINDING,
  listModuleExports,
  moduleHasDefaultExport,
} from "./module-exports.js";

export const EVALUATION_MAIN_MODULE = "evaluation.js";
export const USER_MODULE = "user-module.js";

export interface EvaluationTemplateOptions {
  module?: string;
  script: string;
  preamble?: string;
  envKeys?: readonly string[];
}

export interface EvaluationTemplate {
  mainModule: string;
  modules: Record<string, string>;
}

const RUNTIME_SOURCE = `
const __logs__ = [];
const __originalConsole__ = { ...console };

function __format__(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, __replacer__);
  } catch {
    return String(value);
  }
}

function __replacer__(_key, value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  if (value instanceof Set) {
    return [...value];
  }

  return value;
}

function __capture__(level) {
  return (...args) => {
    if (__logs__.length < 500) {
      __logs__.push({ level, message: args.map(__format__).join(" "), at: Date.now() });
    }

    __originalConsole__[level](...args);
  };
}

for (const level of ["log", "info", "warn", "error", "debug"]) {
  console[level] = __capture__(level);
}

function __serialise__(value) {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value, __replacer__));
  } catch {
    return String(value);
  }
}

function __describeError__(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { name: "Error", message: String(error) };
}
`;

function bindingsSource(options: EvaluationTemplateOptions): string {
  if (!options.module) {
    return "const module = Object.freeze({});";
  }

  const names = listModuleExports(options.module);
  const destructure = names.length > 0 ? `const { ${names.join(", ")} } = __module__;` : "";
  const defaultBinding = moduleHasDefaultExport(options.module)
    ? `const ${DEFAULT_EXPORT_BINDING} = __module__.default;`
    : "";

  return [`const module = __module__;`, destructure, defaultBinding].filter(Boolean).join("\n");
}

function envSource(keys: readonly string[] | undefined): string {
  if (!keys || keys.length === 0) {
    return "const env = Object.freeze({});";
  }

  const picked = keys.map((key) => `${JSON.stringify(key)}: __env__[${JSON.stringify(key)}]`);

  return `const env = Object.freeze({ ${picked.join(", ")} });`;
}

export function renderEvaluationTemplate(options: EvaluationTemplateOptions): EvaluationTemplate {
  const moduleImport = options.module ? `import * as __module__ from "./${USER_MODULE}";` : "";
  const main = `${moduleImport}
${RUNTIME_SOURCE}
${options.preamble ?? ""}
const __moduleLogCount__ = __logs__.length;

async function __run__(env, __module__) {
  ${bindingsSource(options)}
  ${options.script}
}

export default {
  async fetch(request, __env__) {
    __logs__.splice(__moduleLogCount__);
    ${envSource(options.envKeys)}
    const started = Date.now();

    try {
      const value = await __run__(env, ${options.module ? "__module__" : "undefined"});

      return Response.json({
        ok: true,
        value: __serialise__(value),
        logs: __logs__,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      return Response.json({
        ok: false,
        error: __describeError__(error),
        logs: __logs__,
        durationMs: Date.now() - started,
      });
    }
  },
};
`;

  return {
    mainModule: EVALUATION_MAIN_MODULE,
    modules: {
      [EVALUATION_MAIN_MODULE]: main,
      ...(options.module ? { [USER_MODULE]: options.module } : {}),
    },
  };
}
