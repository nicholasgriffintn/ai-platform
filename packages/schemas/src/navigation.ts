import z from "zod/v4";

import { hasControlCharacter } from "./string-validation";

export function isInternalNavigationPath(value: string): boolean {
  const path = value.trim();

  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !hasControlCharacter(path)
  );
}

export function isExternalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());

    if (url.protocol === "https:") {
      return true;
    }

    if (url.protocol !== "http:") {
      return false;
    }

    return (
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname === "[::1]" ||
      /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function requireInternalNavigationPath(value: string): string {
  if (!isInternalNavigationPath(value)) {
    throw new Error("This action cannot open because its navigation path is unsafe.");
  }

  return value.trim();
}

export function requireExternalHttpUrl(value: string): string {
  if (!isExternalHttpUrl(value)) {
    throw new Error("This action cannot open because its external URL is unsafe.");
  }

  return new URL(value.trim()).toString();
}

export const internalNavigationPathSchema = z
  .string()
  .refine(isInternalNavigationPath, "Navigation path must be an internal application path");

export const externalHttpUrlSchema = z
  .string()
  .refine(isExternalHttpUrl, "External URL must use HTTPS (or loopback HTTP)");
