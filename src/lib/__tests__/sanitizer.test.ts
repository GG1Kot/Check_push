import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSecrets } from "../sanitizer";

test("redacts common credential shapes", () => {
  const input = `Authorization: Bearer abc.def.verylongtoken\nGITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456\nDATABASE_URL=postgresql://user:pass@host/db`;
  const result = sanitizeSecrets(input);
  assert.ok(result.redactions >= 3);
  assert.ok(!result.text.includes("ghp_"));
  assert.ok(!result.text.includes("user:pass"));
  assert.ok(result.text.includes("[REDACTED_SECRET]"));
});

test("keeps ordinary code", () => {
  const input = `const tokenCount = 5;\npasswordLabel = "Password";`;
  const result = sanitizeSecrets(input);
  assert.equal(result.redactions, 0);
});
