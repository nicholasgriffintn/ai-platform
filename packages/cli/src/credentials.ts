import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

const credentialSchema = z.object({
  apiKey: z.string().min(1),
  clientName: z.string().min(1),
  createdAt: z.string(),
});

const credentialFileSchema = z.object({
  servers: z.record(z.string(), credentialSchema),
});

export type Credential = z.infer<typeof credentialSchema>;
type CredentialFile = z.infer<typeof credentialFileSchema>;

export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.POLYCHAT_CONFIG_DIR) {
    return join(env.POLYCHAT_CONFIG_DIR, "credentials.json");
  }

  const base =
    process.platform === "win32"
      ? (env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : (env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));

  return join(base, "polychat", "credentials.json");
}

async function readCredentialFile(path: string): Promise<CredentialFile> {
  let text: string;

  try {
    text = await readFile(path, "utf8");
  } catch {
    return { servers: {} };
  }

  const parsed = credentialFileSchema.safeParse(safeParseJson<unknown>(text));

  return parsed.success ? parsed.data : { servers: {} };
}

async function writeCredentialFile(path: string, file: CredentialFile): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;

  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, path);
}

export async function readCredential(path: string, apiBaseUrl: string): Promise<Credential | null> {
  const file = await readCredentialFile(path);

  return file.servers[apiBaseUrl] ?? null;
}

export async function saveCredential(
  path: string,
  apiBaseUrl: string,
  credential: Credential,
): Promise<void> {
  const file = await readCredentialFile(path);

  await writeCredentialFile(path, {
    servers: { ...file.servers, [apiBaseUrl]: credential },
  });
}

export async function forgetCredential(path: string, apiBaseUrl: string): Promise<boolean> {
  const file = await readCredentialFile(path);

  if (!file.servers[apiBaseUrl]) {
    return false;
  }

  const { [apiBaseUrl]: _removed, ...servers } = file.servers;

  await writeCredentialFile(path, { servers });

  return true;
}
