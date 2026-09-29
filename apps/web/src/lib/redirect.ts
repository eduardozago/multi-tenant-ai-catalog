import { z } from "zod";

/** `?redirect=` on /login and /register. Invalid values are dropped, never an error page. */
export const redirectSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

/**
 * Only same-origin paths are honoured: "//evil.com" and "/\evil.com" are
 * protocol-relative URLs for the browser, so they would be an open redirect.
 */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return "/";
  }
  return target;
}
