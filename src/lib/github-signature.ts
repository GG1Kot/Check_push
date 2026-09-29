import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !secret || !signature.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
