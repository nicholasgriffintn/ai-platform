import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const publicHttpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url())
  .refine((value) => {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !isPrivateHostname(url.hostname)
    );
  }, "Use a public HTTPS URL without embedded credentials or a fragment");

export const httpsOriginSchema = publicHttpsUrlSchema
  .refine((value) => {
    const url = new URL(value);

    return url.pathname === "/" && !url.search;
  }, "Use an HTTPS origin without a path or query")
  .transform((value) => new URL(value).origin);
