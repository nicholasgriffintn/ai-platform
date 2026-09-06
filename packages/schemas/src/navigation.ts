import { isLoopbackHostname } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);

    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

export function isInternalNavigationPath(value: string): boolean {
  const path = value.trim();

  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !hasControlCharacter(path)
  );
}

export function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(new URL(value.trim()).hostname);
  } catch {
    return false;
  }
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

    return isLoopbackHostname(url.hostname);
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
