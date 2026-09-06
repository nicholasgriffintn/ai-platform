export type ProductPlace = "chat" | "work" | "attention" | "files" | "library" | "you";

export const PLACE_PATHS: Record<ProductPlace, string> = {
  chat: "/chat",
  work: "/work",
  attention: "/attention",
  files: "/files",
  library: "/chat/capabilities",
  you: "/profile",
};

const PLACE_PREFIXES: Array<[ProductPlace, string[]]> = [
  ["attention", ["/attention"]],
  ["files", ["/files"]],
  ["library", ["/chat/capabilities", "/chat/tools", "/chat/agents", "/chat/experiences"]],
  ["you", ["/profile"]],
  ["work", ["/work"]],
  ["chat", ["/", "/chat"]],
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") {
    return pathname === "/";
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getActivePlace(pathname: string): ProductPlace | undefined {
  for (const [place, prefixes] of PLACE_PREFIXES) {
    if (prefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
      return place;
    }
  }

  return undefined;
}
