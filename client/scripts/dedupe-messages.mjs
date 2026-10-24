/**
 * Finds messages that live in more than one domain file, and takes the
 * duplicates out.
 *
 * The domains are merged into one dictionary, so a key that appears twice is
 * translated twice — and the second one silently wins, which means the same
 * sentence can read differently in two places. The first domain to claim a
 * message keeps it; the others let it go.
 *
 *   node scripts/dedupe-messages.mjs          # report only
 *   node scripts/dedupe-messages.mjs --fix    # take the duplicates out
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const messages = join(root, "lib/i18n/messages");

/** The order the domains are merged in — the first one to claim a key keeps it. */
const DOMAINS = [
  "shell",
  "common",
  "dashboard",
  "sales",
  "expenses",
  "products",
  "tools",
  "settings",
];

const fix = process.argv.includes("--fix");

/** The keys of a message file, in order. */
function keys(text) {
  const found = [];
  const pattern = /^\s*"((?:[^"\\]|\\.)*)":/gm;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    found.push(match[1]);
  }
  return found;
}

const owner = new Map();
const duplicates = [];

for (const domain of DOMAINS) {
  const text = readFileSync(join(messages, "en", `${domain}.ts`), "utf8");
  for (const key of keys(text)) {
    if (owner.has(key)) duplicates.push({ key, keep: owner.get(key), drop: domain });
    else owner.set(key, domain);
  }
}

for (const { key, keep, drop } of duplicates) {
  console.log(`"${key}" — kept in ${keep}, removed from ${drop}`);
}
console.log(`\n${duplicates.length} duplicate(s) across ${owner.size} messages.`);

if (!fix) process.exit(0);

/* Take the duplicates out of the English master; the other languages follow
   when the messages are synced. */
for (const domain of DOMAINS) {
  const path = join(messages, "en", `${domain}.ts`);
  const text = readFileSync(path, "utf8");
  const drop = new Set(
    duplicates.filter((entry) => entry.drop === domain).map((entry) => entry.key)
  );
  if (!drop.size) continue;

  /* A message may be written over two lines — the key on one, the value on
     the next — so the whole entry has to go, not just its first line. */
  const lines = text.split("\n");
  const kept = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*"((?:[^"\\]|\\.)*)":/);
    if (match && drop.has(match[1])) {
      // Skip the value line too, if the entry continues on the next one.
      if (!lines[index].includes(":", lines[index].indexOf(":") + 1)) {
        const next = lines[index + 1] ?? "";
        if (/^\s*"(?:[^"\\]|\\.)*",?$/.test(next)) index += 1;
      }
      continue;
    }
    kept.push(lines[index]);
  }

  writeFileSync(path, kept.join("\n"));
  console.log(`cleaned ${domain}`);
}
