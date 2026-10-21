/**
 * A quick check that the voice grammar understands the languages the app is
 * written in. Run with:
 *
 *   node scripts/check-voice.mjs
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { buildGrammar, bestVoiceMatch, searchTerm, voiceLocale, AUTO_RUN_SCORE } = jiti("../lib/voice.ts");
const { translate } = jiti("../lib/i18n/index.ts");

const LOCALES = {
  en: {
    nav: [
      { href: "/", label: "Dashboard" },
      { href: "/sales", label: "Sales" },
      { href: "/expenses", label: "Expenses" },
      { href: "/products", label: "Products" },
      { href: "/settings", label: "Settings" },
    ],
    theme: [{ mode: "dark", label: "Dark theme", phrases: ["dark mode"] }],
    refresh: { label: "Refresh data", phrases: ["refresh", "reload"] },
    stop: { label: "Stop listening", phrases: ["stop", "cancel"] },
    said: ["sales", "open settings", "dark mode", "refresh data", "stop"],
    unheard: ["what is the status", "I had a sale yesterday", "hello there"],
  },
  ta: {
    nav: [
      { href: "/", label: "டாஷ்போர்டு" },
      { href: "/sales", label: "விற்பனை" },
      { href: "/expenses", label: "செலவு" },
      { href: "/products", label: "பொருட்கள்" },
      { href: "/settings", label: "அமைப்புகள்" },
    ],
    theme: [{ mode: "dark", label: "இருள் தீம்", phrases: [] }],
    refresh: { label: "புதுப்பி", phrases: ["refresh"] },
    stop: { label: "நிறுத்து", phrases: ["stop"] },
    said: ["விற்பனை", "அமைப்புகளைத் திற", "முகப்பு", "செலவு"],
    unheard: ["என்ன நிலை", "நேற்று ஒரு விற்பனை", "வணக்கம்"],
  },
  hi: {
    nav: [
      { href: "/", label: "डैशबोर्ड" },
      { href: "/sales", label: "बिक्री" },
      { href: "/expenses", label: "खर्च" },
      { href: "/products", label: "उत्पाद" },
      { href: "/settings", label: "सेटिंग" },
    ],
    theme: [{ mode: "dark", label: "डार्क थीम", phrases: [] }],
    refresh: { label: "रिफ्रेश", phrases: ["refresh"] },
    stop: { label: "रोकें", phrases: ["stop"] },
    said: ["बिक्री", "सेटिंग खोलो", "होम", "खर्च"],
    unheard: ["स्थिति क्या है", "कल एक बिक्री हुई", "नमस्ते"],
  },
  ml: {
    nav: [
      { href: "/", label: "ഡാഷ്ബോർഡ്" },
      { href: "/sales", label: "വിൽപ്പന" },
      { href: "/expenses", label: "ചെലവുകൾ" },
      { href: "/products", label: "ഉൽപ്പന്നങ്ങൾ" },
      { href: "/settings", label: "ക്രമീകരണങ്ങൾ" },
    ],
    theme: [{ mode: "dark", label: "ഡാർക് തീം", phrases: [] }],
    refresh: { label: "പുതുക്കുക", phrases: ["refresh"] },
    stop: { label: "നിർത്തുക", phrases: ["stop"] },
    said: ["വിൽപ്പന", "ക്രമീകരണങ്ങൾ തുറക്കുക", "ഹോം", "ചെലവുകൾ"],
    unheard: ["അവസ്ഥ എന്താണ്", "നിന്നലെ ഒരു വിൽപ്പന", "നമസ്കാരം"],
  },
};

let failures = 0;

/* The actions a page puts up for voice: "new sale", "export csv", and so on. */
const OPS = [
  { id: "sales-new-sale", label: "New sale", phrases: ["new sale", "add sale", "create bill"] },
  { id: "sales-export-csv", label: "Export CSV", phrases: ["export csv", "download csv"] },
  { id: "sales-clear-filters", label: "Clear filters", phrases: ["clear filters", "reset filters"] },
  { id: "pagination-next-page", label: "Next page", phrases: ["next page", "more results"] },
  { id: "sale-form-save", label: "Save sale", phrases: ["save sale", "save it"] },
];

const opCandidates = OPS.flatMap((op) =>
  [op.label, ...op.phrases].map((phrase) => ({
    phrase: phrase.split(" "),
    action: { kind: "op", id: op.id, label: op.label },
  }))
);

for (const [locale, spec] of Object.entries(LOCALES)) {
  const grammar = buildGrammar(locale, spec, opCandidates);
  for (const said of spec.said) {
    const matches = bestVoiceMatch([said], { grammar });
    const top = matches[0];
    const ok = top && top.score >= AUTO_RUN_SCORE;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${locale} "${said}" → ${top ? `${top.action.label} (${top.score})` : "nothing"}`
    );
  }

  /* Ordinary conversation must not switch pages. */
  for (const said of spec.unheard ?? []) {
    const matches = bestVoiceMatch([said], { grammar });
    const top = matches[0];
    const ok = !top || top.score < AUTO_RUN_SCORE;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${locale} "${said}" → ${top ? `${top.action.label} (${top.score})` : "nothing"}`
    );
  }
}


/* The actions of the page on screen must be reachable by voice too. */
for (const said of ["new sale", "export csv", "clear filters", "next page", "save sale"]) {
  const matches = bestVoiceMatch([said], { grammar: buildGrammar("en", LOCALES.en, opCandidates) });
  const top = matches[0];
  const ok = top && top.score >= AUTO_RUN_SCORE && top.action.kind === "op";
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok  " : "FAIL"} action "${said}" -> ${top ? `${top.action.label} (${top.score})` : "nothing"}`
  );
}


/* What was said is taken apart: the search word goes, the rest is the term. */
const SEARCHES = [
  ["en", "search for Asha Menon", "Asha Menon"],
  ["en", "find Asha", "Asha"],
  ["ta", "ஆஶா தேடு", "ஆஶா"],
  ["hi", "आशा खोजो", "आशा"],
  ["ml", "ആശ തിരയുക്", "ആശ"],
];

for (const [language, spoken, expected] of SEARCHES) {
  const term = searchTerm(spoken, language);
  const ok = term === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} search ${language} "${spoken}" -> "${term}"`);
}


/* The phrases people actually use, in the language they speak. */
const SPOKEN = [
  ["ta", "செட்டிங்ஸ் ஓப்பன் பண்ணுங்க", "/settings"],
  ["ta", "செட்டிங்ஸ்", "/settings"],
  ["ta", "விற்பனை ஓப்பன் பண்ணுங்க", "/sales"],
  ["hi", "सेटिंग खोलो", "/settings"],
  ["hi", "सेटिंग्स खोलिए", "/settings"],
  ["hi", "बिक्री खोलो", "/sales"],
  ["ml", "ക്രമീകരണങ്ങൾ തുറക്കുക", "/settings"],
  ["ml", "സെറ്റിംഗ് തുറക്കുക", "/settings"],
  ["ml", "വിൽപ്പന തുറക്കുക", "/sales"],
  ["en", "open settings", "/settings"],
];

for (const [locale, spoken, href] of SPOKEN) {
  const grammar = buildGrammar(locale, LOCALES[locale], opCandidates);
  const matches = bestVoiceMatch([spoken], { grammar });
  const top = matches[0];
  const ok = top && top.score >= AUTO_RUN_SCORE && top.action.kind === "navigate" && top.action.href === href;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${locale} "${spoken}" -> ${top ? `${top.action.label} (${top.score})` : "nothing"}`
  );
}


/* The language of the voice conversation, and the replies that go with it. */
const CHOICES = [
  ["ta-IN", "en", "ta"],
  ["", "ta", "ta"],
  ["hi-IN", "en", "hi"],
  ["ml-IN", "en", "ml"],
  ["en-IN", "ml", "en"],
];

for (const [chosen, app, expected] of CHOICES) {
  const locale = voiceLocale(chosen, app);
  const ok = locale === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} voice language "${chosen || "follow the app"}" on "${app}" -> "${locale}"`);
}

/* The reply comes back in the voice language, whatever the interface is in. */
const reply = translate(voiceLocale("ta-IN", "en"), "Opened {page}", { page: translate("ta", "Settings") });
const speaksTamil = /[\u0B80-\u0BFF]/.test(reply);
if (!speaksTamil) failures += 1;
console.log(`${speaksTamil ? "ok  " : "FAIL"} the reply is in the voice language — "${reply}"`);

console.log(failures ? `\n${failures} phrase(s) did not match` : "\nEvery phrase matched.");
process.exit(failures ? 1 : 0);