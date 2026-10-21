/**
 * Regenerates the dictionaries for the non-English languages from the English
 * master copy.
 *
 * Translations already made are kept; only new messages are added, and they
 * arrive in English so a translator can pick them up. Running this is how a
 * new message in the English file gets added to every other language without
 * anyone hunting through nine files by hand.
 *
 *   node scripts/sync-messages.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const messages = join(root, "lib/i18n/messages");

const LOCALES = ["ta", "hi", "ml"];
const DOMAINS = [
  "shell",
  "common",
  "dashboard",
  "sales",
  "expenses",
  "products",
  "tools",
  "developer",
  "settings",
];

/** Reads `"key": "value"` pairs out of a message file. */
function parse(text) {
  const pairs = [];
  const pattern = /"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    pairs.push([match[1], match[2]]);
  }
  return pairs;
}

const available = DOMAINS.filter((domain) => existsSync(join(messages, "en", `${domain}.ts`)));

for (const domain of available) {
  const source = join(messages, "en", `${domain}.ts`);
  const pairs = parse(readFileSync(source, "utf8"));

  for (const locale of LOCALES) {
    const target = join(messages, locale, `${domain}.ts`);
    mkdirSync(dirname(target), { recursive: true });

    /* Translations already made are kept; only new messages are added, and
       they arrive in English so a translator can pick them up. */
    const existing = new Map();
    if (existsSync(target)) {
      for (const [key, value] of parse(readFileSync(target, "utf8"))) {
        existing.set(key, value);
      }
    }

    const body = pairs
      .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(existing.get(key) ?? value)},`)
      .join("\n");

    const file = `import type { ${domain} as en } from "../en/${domain}";\n\nexport const ${domain}: Record<keyof typeof en, string> = {\n${body}\n};\n`;
    writeFileSync(target, file);
    console.log(`wrote ${locale}/${domain}.ts (${pairs.length} messages)`);
  }
}

/* The merged dictionary of each language. */
for (const locale of LOCALES) {
  const imports = available.map(
    (domain) => `import { ${domain} } from "./${domain}";`
  ).join("\n");
  const spreads = available.map((domain) => `  ...${domain},`).join("\n");
  const exports = available.map((domain) => `export { ${domain} };`).join("\n");

  const file = `${imports}
import type { en } from "../en";

/**
 * The ${locale} translation of every message in the app.
 *
 * Typed against the English master copy: a message that exists in English but
 * not here is a build error, so a language can never quietly lose a line.
 */
export const ${locale}: Record<keyof typeof en, string> = {
${spreads}
};

${exports}
`;
  writeFileSync(join(messages, locale, "index.ts"), file);
  console.log(`wrote ${locale}/index.ts`);
}
