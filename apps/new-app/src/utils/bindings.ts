/***
 * Example of how to use this:
 * 
 *  import { createServerFn } from "@tanstack/react-start";
    import { getBindings } from "~/utils/bindings";

    const personServerFn = createServerFn({ method: "GET" })
      .validator((d: string) => d)
      .handler(async ({ data: name }) => {
        const env = getBindings();
        let growingAge = Number((await env.CACHE.get("age")) || 0);
        growingAge++;
        await env.CACHE.put("age", growingAge.toString());
        return { name, randomNumber: growingAge };
      });
 */

let cachedEnv: Env | null = null;

const initDevEnv = async () => {
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy();
  cachedEnv = proxy.env as unknown as Env;
};

if (import.meta.env.DEV) {
  await initDevEnv();
}

export function getBindings(): Env {
  if (import.meta.env.DEV) {
    if (!cachedEnv) {
      throw new Error(
        "Dev bindings not initialized yet. Call initDevEnv() first.",
      );
    }
    return cachedEnv;
  }

  return process.env as unknown as Env;
}
