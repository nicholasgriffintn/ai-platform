export function isProductModeRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname === "/work" ||
    pathname.startsWith("/work/")
  );
}
