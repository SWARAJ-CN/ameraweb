/**
 * Lists the messages that are still in English in a translation file.
 *
 *   node scripts/untranslated.mjs ta
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const messages = join(root, "lib/i18n/messages");

const locale = process.argv[2] ?? "ta";
const domains = process.argv.slice(3);

function parse(text) {
  const pairs = [];
  const pattern = /"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    pairs.push([match[1], match[2]]);
  }
  return pairs;
}

const files = domains.length
  ? domains.map((domain) => join(messages, locale, `${domain}.ts`))
  : [];

let total = 0;
for (const file of files) {
  const pairs = parse(readFileSync(file, "utf8"));
  const pending = pairs.filter(([key, value]) => key === value);
  total += pending.length;
  console.log(`${file.split("/").pop()}: ${pending.length} of ${pairs.length} still English`);
}
console.log(`\n${total} message(s) left to translate in ${locale}.`);
