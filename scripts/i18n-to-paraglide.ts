/**
 * Flatten the nested next-intl message catalogs (messages/{locale}.json) into the
 * flat key→value shape Paraglide's inlang message-format plugin expects
 * (messages/paraglide/{locale}.json). Nested namespaces are joined with "_" and
 * sanitized to valid identifiers.
 *
 * The next-intl files stay the source of truth until Phase 5; re-run this script
 * whenever they change:  bun scripts/i18n-to-paraglide.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["en", "id", "zh"] as const;
const SRC_DIR = join(process.cwd(), "messages");
const OUT_DIR = join(SRC_DIR, "paraglide");

/** next-intl key segment -> valid Paraglide identifier segment. */
function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9]/g, "_");
}

/** Index of the "}" that closes the "{" at `openIdx` (brace-depth matched). */
function matchBrace(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/**
 * Paraglide's inlang message-format plugin does NOT understand raw ICU
 * `{var, plural, one {…} other {…}}` strings — it treats the whole thing as a
 * malformed interpolation and emits garbage at runtime. Complex (variant)
 * messages must instead be authored as the array+`match` form. This parses a
 * single ICU plural block (with optional literal text around it) into that
 * shape. `#` becomes `{var}`. Returns null when there's no plural to convert.
 * `select` is not handled here — those are flattened to discrete keys upstream.
 */
type InlangVariantMessage = Array<{
  declarations: string[];
  selectors: string[];
  match: Record<string, string>;
}>;

function parseIcuPlural(value: string): InlangVariantMessage | null {
  const headRe = /\{\s*(\w+)\s*,\s*plural\s*,/;
  const headAt = value.search(headRe);
  if (headAt === -1) return null;

  const openIdx = value.indexOf("{", headAt);
  const closeIdx = matchBrace(value, openIdx);
  if (closeIdx === -1) return null;

  const prefix = value.slice(0, openIdx);
  const suffix = value.slice(closeIdx + 1);
  const block = value.slice(openIdx + 1, closeIdx);

  const head = block.match(/^\s*(\w+)\s*,\s*plural\s*,/);
  if (!head) return null;
  const variable = head[1];

  const branches: Array<{ category: string; text: string }> = [];
  const catRe = /\s*(=\d+|zero|one|two|few|many|other)\s*/y;
  let pos = head[0].length;
  while (pos < block.length) {
    catRe.lastIndex = pos;
    const cat = catRe.exec(block);
    if (!cat) break;
    const braceOpen = block.indexOf("{", catRe.lastIndex);
    if (braceOpen === -1) break;
    const braceClose = matchBrace(block, braceOpen);
    if (braceClose === -1) break;
    const text = block
      .slice(braceOpen + 1, braceClose)
      .replace(/#/g, `{${variable}}`);
    branches.push({ category: cat[1], text });
    pos = braceClose + 1;
  }
  if (!branches.length) return null;

  // Exact-value categories (=0) need a raw-value selector, not the plural
  // matcher — not present in this catalog, so leave such messages raw (visibly
  // broken) rather than emit a silently-wrong conversion.
  if (branches.some((b) => b.category.startsWith("="))) return null;

  // Declare the plural var + any other interpolations found in the text.
  const localName = `${variable}Plural`;
  const extraVars = new Set<string>();
  const collect = (s: string) => {
    for (const m of s.matchAll(/\{(\w+)\}/g)) extraVars.add(m[1]);
  };
  collect(prefix);
  collect(suffix);
  branches.forEach((b) => collect(b.text));
  extraVars.delete(variable);

  const match: Record<string, string> = {};
  for (const b of branches) {
    match[`${localName}=${b.category}`] = `${prefix}${b.text}${suffix}`;
  }

  return [
    {
      declarations: [
        `input ${variable}`,
        ...[...extraVars].map((v) => `input ${v}`),
        `local ${localName} = ${variable}: plural`,
      ],
      selectors: [localName],
      match,
    },
  ];
}

type Nested = { [key: string]: string | Nested };

function flatten(
  node: Nested,
  prefix: string,
  out: Record<string, unknown>,
  collisions: string[],
): void {
  for (const [key, value] of Object.entries(node)) {
    const flatKey = prefix
      ? `${prefix}_${sanitizeSegment(key)}`
      : sanitizeSegment(key);
    if (value && typeof value === "object") {
      flatten(value as Nested, flatKey, out, collisions);
    } else {
      if (flatKey in out) collisions.push(flatKey);
      const str = String(value);
      out[flatKey] = parseIcuPlural(str) ?? str;
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const keyCounts: Record<string, number> = {};
for (const locale of LOCALES) {
  const nested = JSON.parse(
    readFileSync(join(SRC_DIR, `${locale}.json`), "utf8"),
  ) as Nested;
  const flat: Record<string, unknown> = {};
  const collisions: string[] = [];
  flatten(nested, "", flat, collisions);

  if (collisions.length) {
    console.warn(
      `[${locale}] key collisions after flattening:`,
      collisions.join(", "),
    );
  }

  const ordered: Record<string, unknown> = {
    $schema: "https://inlang.com/schema/inlang-message-format",
  };
  for (const k of Object.keys(flat).sort()) ordered[k] = flat[k];

  writeFileSync(
    join(OUT_DIR, `${locale}.json`),
    JSON.stringify(ordered, null, 2) + "\n",
  );
  keyCounts[locale] = Object.keys(flat).length;
  console.log(`[${locale}] wrote ${keyCounts[locale]} messages`);
}

// Report key drift between locales (missing translations).
const base = new Set(
  Object.keys(
    JSON.parse(readFileSync(join(OUT_DIR, "id.json"), "utf8")),
  ).filter((k) => k !== "$schema"),
);
for (const locale of LOCALES) {
  if (locale === "id") continue;
  const keys = new Set(
    Object.keys(
      JSON.parse(readFileSync(join(OUT_DIR, `${locale}.json`), "utf8")),
    ).filter((k) => k !== "$schema"),
  );
  const missing = [...base].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !base.has(k));
  if (missing.length) console.warn(`[${locale}] missing ${missing.length} keys vs id`);
  if (extra.length) console.warn(`[${locale}] has ${extra.length} keys not in id`);
}
