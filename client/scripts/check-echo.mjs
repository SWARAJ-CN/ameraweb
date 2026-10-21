/**
 * Checks that the app cannot hear itself.
 *
 * The assistant says "Opened Settings"; the microphone, still open, hears it
 * and takes it for a command — which would open Settings again, say it again,
 * and go round for ever. These checks cover the two guards against that: the
 * microphone is shut while the app is talking, and one utterance runs one
 * command.
 *
 *   node scripts/check-echo.mjs
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { collectSpeech } = jiti("../lib/voice.ts");
const { speak, isSpeaking, subscribeSpeech, stopSpeaking } = jiti("../lib/speech.ts");

let failures = 0;

function check(label, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

/* ------------------------------------------------------------ the speaking state */

/* The browser's speech synthesis, stood in for. */
let utterance = null;
global.window = {
  speechSynthesis: {
    cancel() {},
    speak(next) {
      utterance = next;
    },
    getVoices: () => [],
  },
};
global.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
  }
};

const seen = [];
const release = subscribeSpeech((talking) => seen.push(talking));

speak("Opened Settings", { mode: "male", lang: "en-IN" });
check("the app is speaking", isSpeaking() === true);
check("the microphone is told", seen[seen.length - 1] === true);

/* The utterance ends, as it does when the words are done. */
utterance.onend?.();
check("the app has stopped speaking", isSpeaking() === false);
check("the microphone is told again", seen[seen.length - 1] === false);

/* A second announcement queues behind the first. */
speak("Opened Products", { mode: "male", lang: "en-IN" });
check("speaking again", isSpeaking() === true);
stopSpeaking();
check("stopping clears the state", isSpeaking() === false);
release();

/* ------------------------------------------------- one utterance, one command */

/* The recogniser hands over what it has already finalised, again and again. */
const one = [
  { isFinal: true, length: 2, 0: { transcript: "open settings" }, 1: { transcript: "open setting" } },
];

let lastFinal = -1;
let runs = 0;
let first = null;
for (const fromIndex of [0, 0, 0]) {
  const taken = collectSpeech(one, fromIndex, lastFinal);
  if (!first) first = taken;
  lastFinal = taken.lastFinal;
  if (taken.text.trim()) runs += 1;
}

check("one command from three handovers", runs === 1, `${runs} command(s)`);
check("the words are taken", first.text === "open settings", first.text);
check(
  "the runner-up readings come with it",
  first.readings.length === 2 && first.readings[1] === "open setting",
  first.readings.join(", ")
);

const again = collectSpeech(one, 0, lastFinal);
check("nothing is taken a second time", again.text === "", again.text);

/* Two results finalised together are two utterances, and each is taken once. */
const two = [
  { isFinal: true, length: 1, 0: { transcript: "open settings" } },
  { isFinal: true, length: 1, 0: { transcript: "open products" } },
];

const firstTake = collectSpeech(two, 0, -1);
check("both results are taken", firstTake.lastFinal === 1, `last final ${firstTake.lastFinal}`);

const secondTake = collectSpeech(two, 0, firstTake.lastFinal);
check("nothing is taken twice", secondTake.text === "", secondTake.text);

/* A result that is not final yet is still being said. */
const talking = [{ isFinal: false, length: 1, 0: { transcript: "open sett" } }];
const midWay = collectSpeech(talking, 0, -1);
check("a half-spoken phrase is not a command", midWay.text === "", midWay.text);

console.log(failures ? `\n${failures} check(s) failed` : "\nThe app cannot hear itself.");
process.exit(failures ? 1 : 0);
