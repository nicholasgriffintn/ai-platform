import { execFile } from "node:child_process";

function browserCommand(url: string): [string, string[]] | null {
  switch (process.platform) {
    case "darwin":
      return ["open", [url]];
    case "win32":
      return ["rundll32", ["url.dll,FileProtocolHandler", url]];
    case "linux":
    case "freebsd":
    case "openbsd":
      return ["xdg-open", [url]];
    default:
      return null;
  }
}

export function openInBrowser(url: string): Promise<boolean> {
  const parsed = URL.canParse(url) ? new URL(url) : null;
  const command = parsed && /^https?:$/.test(parsed.protocol) ? browserCommand(parsed.href) : null;

  if (!command) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const child = execFile(command[0], command[1], (error) => resolve(!error));

    child.unref();
  });
}
