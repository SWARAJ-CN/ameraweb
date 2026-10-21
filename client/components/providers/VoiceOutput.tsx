"use client";

import { useSyncExternalStore } from "react";
import {
  announce,
  readVoiceMode,
  readVoiceModeOnServer,
  readVoiceOutput,
  readVoiceOutputOnServer,
  setVoiceMode,
  setVoiceOutput,
  subscribeVoiceOutput,
} from "@/lib/announcer";
import { useVoiceLanguage } from "./VoiceLanguage";
import type { VoiceMode } from "@/lib/speech";

interface VoiceOutputValue {
  /** Whether the app speaks what is happening. */
  enabled: boolean;
  /** Which character the voice has. */
  mode: VoiceMode;
  setEnabled: (enabled: boolean) => void;
  setMode: (mode: VoiceMode) => void;
}

/**
 * The voice output switch and the character of the voice.
 *
 * Turning the voice on says so out loud, so the reader knows the app can
 * speak before anything else happens.
 */
export function useVoiceOutput(): VoiceOutputValue {
  /* The assistant speaks the language of the voice conversation. */
  const { t } = useVoiceLanguage();

  const enabled = useSyncExternalStore(
    subscribeVoiceOutput,
    readVoiceOutput,
    readVoiceOutputOnServer
  );
  const mode = useSyncExternalStore(
    subscribeVoiceOutput,
    readVoiceMode,
    readVoiceModeOnServer
  );

  return {
    enabled,
    mode,
    setEnabled: (next: boolean) => {
      setVoiceOutput(next);
      if (next) {
        /* Say so, and say what the microphone can be asked for — the switch is
           the only place the reader finds out the app can speak at all. */
        announce(t("Voice output is on. I will tell you when you open a page or save something."), {
          force: true,
        });
        announce(
          t("You can say a page name, “open settings”, “dark mode” or “refresh data”."),
          { force: true, queue: true }
        );
      } else {
        announce(t("Voice output is off."), { force: true });
      }
    },
    setMode: (next: VoiceMode) => {
      setVoiceMode(next);
      const label = next === "male" ? t("Male") : next === "female" ? t("Female") : t("Kid");
      announce(t("Voice mode set to {mode}.", { mode: label }), { force: true });
    },
  };
}
