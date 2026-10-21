"use client";

import { SegmentedControl } from "@/components/ui/Controls";
import { Switch } from "@/components/ui/Switch";
import { useI18n } from "@/components/providers/I18nProvider";
import { useVoiceOutput } from "@/components/providers/VoiceOutput";
import { VOICE_MODES, type VoiceMode } from "@/lib/speech";
import { cn } from "@/lib/cn";

/**
 * The voice output switch and the character of the voice.
 *
 * Shown in the voice panel and again in the settings, because one is where
 * people look when they want to talk to the app and the other is where they
 * look when they want to change how it sounds.
 */
export function VoiceOutputControls({
  id = "voice-output",
  className,
}: {
  /** Unique per instance: the switch and its label share it. */
  id?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { enabled, mode, setEnabled, setMode } = useVoiceOutput();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-[11px] font-semibold tracking-wide text-muted uppercase"
          htmlFor={id}
        >
          {t("Voice output")}
        </label>
        <Switch
          id={id}
          checked={enabled}
          onChange={setEnabled}
          aria-label={t("Voice output")}
        />
      </div>

      <p className="text-[11px] text-faint-foreground">
        {t("Speak what happens as you use the app")}
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          {t("Voice mode")}
        </span>
        <SegmentedControl
          ariaLabel={t("Voice mode")}
          value={mode}
          onChange={(value) => setMode(value as VoiceMode)}
          options={VOICE_MODES.map((entry) => ({
            value: entry.value,
            label: t(entry.label),
          }))}
        />
      </div>
    </div>
  );
}
