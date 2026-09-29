export type Sanitized = { text: string; redactions: number };

const PATTERNS: RegExp[] = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b(?:xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
];

const KEY_VALUE = /^([+\-\s]*[A-Za-z_][A-Za-z0-9_.-]{1,80}\s*[=:]\s*)([^\s#]{8,})(.*)$/gm;
const SENSITIVE_KEY = /(secret|token|password|passwd|pwd|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?key|database[_-]?url|connection[_-]?string|auth)/i;

export function sanitizeSecrets(input: string): Sanitized {
  let text = input;
  let redactions = 0;

  for (const pattern of PATTERNS) {
    text = text.replace(pattern, () => {
      redactions += 1;
      return "[REDACTED_SECRET]";
    });
  }

  text = text.replace(KEY_VALUE, (whole, prefix: string, value: string, suffix: string) => {
    const key = prefix.replace(/^[+\-\s]*/, "").split(/[=:]/)[0] ?? "";
    if (!SENSITIVE_KEY.test(key)) return whole;
    if (/^(true|false|null|none|example|changeme|placeholder)$/i.test(value)) return whole;
    redactions += 1;
    return `${prefix}[REDACTED_SECRET]${suffix}`;
  });

  return { text, redactions };
}
