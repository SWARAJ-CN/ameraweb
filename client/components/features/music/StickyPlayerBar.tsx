"use client";

import Image from "next/image";
import { useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  ListMusic,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sliders,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Waveform } from "./Waveform";
import {
  BASS_PRESET_LABEL,
  EQ_BANDS,
  EQ_PRESETS,
  SPATIAL_MODES,
  useMusicPlayer,
  type EqPreset,
  type SpatialMode,
} from "@/components/providers/MusicPlayerProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * The persistent listening bar. Rendered once in the app shell so it floats
 * above every page; the queue keeps playing while the user browses around
 * (or leaves the browser minimized — the OS media session keeps it alive).
 *
 * Layouts: phones stack in two tidy rows (info / seek + EQ); sm and up use a
 * strict 3-column grid (details · transport · extras) so the seek row is
 * perfectly centred at every width. The EQ panel holds presets, band sliders
 * and the 8D / 3D / surround space modes.
 */
export function StickyPlayerBar() {
  const [eqOpen, setEqOpen] = useState(false);
  const [bassConfirm, setBassConfirm] = useState(false);
  const {
    queue,
    queueLabel,
    index,
    current,
    playing,
    progress,
    duration,
    volume,
    muted,
    playerError,
    visualizerReady,
    eqPreset,
    eqGains,
    spatialMode,
    getAnalyser,
    togglePlay,
    stepTrack,
    seek,
    setVolume,
    setMuted,
    applyPreset,
    setEqGains,
    setSpatialMode,
  } = useMusicPlayer();

  if (!current) return null;

  /** Live bars with a CSS mimic fallback when CORS blocks the analyser. */
  const renderWave = (className: string, tone: string) => (
    <span className={cn("grid place-items-center p-1", className)}>
      {visualizerReady ? (
        <Waveform
          getAnalyser={getAnalyser}
          active={playing}
          className={cn("h-full w-full", tone)}
        />
      ) : (
        <span className={cn("eq", tone)}>
          <span />
          <span />
          <span />
        </span>
      )}
    </span>
  );

  const transport = (size: "sm" | "lg") => {
    const playSize = size === "lg" ? "size-11" : "size-10";
    const keySize = size === "lg" ? "size-9" : "size-8";
    const icon = size === "lg" ? "size-4" : "size-4 sm:size-[17px]";
    return (
      <div className="flex items-center justify-center gap-0.5 sm:gap-1">
        <button
          type="button"
          title="Previous"
          aria-label="Previous track"
          onClick={() => stepTrack(-1)}
          disabled={index <= 0 && progress <= 3}
          className={cn(
            "grid place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
            keySize
          )}
        >
          <SkipBack className={cn(icon, "fill-current")} />
        </button>
        <button
          type="button"
          title={playing ? "Pause" : "Play"}
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
          className={cn(
            "grid place-items-center rounded-full bg-foreground text-background transition-transform duration-150 hover:scale-105 active:scale-95",
            playSize
          )}
        >
          {playing ? (
            <Pause className={cn(icon, "fill-current")} />
          ) : (
            <Play className={cn(icon, "translate-x-px fill-current")} />
          )}
        </button>
        <button
          type="button"
          title="Next"
          aria-label="Next track"
          onClick={() => stepTrack(1)}
          className={cn(
            "grid place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground",
            keySize
          )}
        >
          <SkipForward className={cn(icon, "fill-current")} />
        </button>
      </div>
    );
  };

  const seekRow = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-9 flex-none text-end text-[10px] font-semibold tabular-nums text-muted-foreground sm:w-10 sm:text-[11px]">
        {formatSeconds(progress)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={1}
        value={Math.min(progress, duration || progress)}
        aria-label="Seek"
        onChange={(event) => seek(Number(event.target.value))}
        className="h-1.5 min-w-0 w-full cursor-pointer rounded-full sm:h-2"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="w-9 flex-none text-[10px] font-semibold tabular-nums text-muted-foreground sm:w-10 sm:text-[11px]">
        {formatSeconds(duration)}
      </span>
    </div>
  );

  /** Bass boost needs a hearing-safety confirmation before it engages. */
  const choosePreset = (preset: EqPreset) => {
    if (preset.label === BASS_PRESET_LABEL && eqPreset !== preset.label) {
      setBassConfirm(true);
      return;
    }
    applyPreset(preset);
  };

  const eqChipActive = eqOpen || eqPreset !== EQ_PRESETS[0].label || spatialMode !== "off";

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div
          className="mx-auto w-full max-w-[100rem] px-3 pb-3 sm:px-6 lg:px-8 lg:ps-[calc(var(--sidebar-width)+1.5rem)]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {/* Equalizer + space panel floats above the bar. */}
          {eqOpen ? (
            <div className="glass mb-2 ml-auto w-full max-w-2xl rounded-t-field border border-b-0 border-separator px-4 pb-3 pt-3 shadow-pop sm:border-b-0 lg:max-w-3xl lg:rounded-b-none lg:border-b-0">
              <div className="flex items-center justify-between gap-2 pb-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Equalizer
                </p>
                <div className="flex flex-1 items-center gap-3">
                  {visualizerReady ? (
                    <div className="h-4 w-24 sm:block lg:w-56">
                      {renderWave("h-full w-full", "text-brand")}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEqOpen(false)}
                    className="min-h-8 px-1 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
                  >
                    Close ✕
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {EQ_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={eqPreset === preset.label}
                    onClick={() => choosePreset(preset)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors duration-150",
                      eqPreset === preset.label
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-separator bg-surface text-muted hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Responsive band grid: stacks on phones,
                  3 across on tablets, 5 across on desktop. */}
              <div className="grid grid-cols-1 gap-2.5 pt-3 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
                {EQ_BANDS.map((band, bandIndex) => (
                  <div key={band.frequency} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] font-medium text-muted">
                      {band.label}
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={eqGains[bandIndex]}
                      aria-label={`${band.label} Hz gain`}
                      onChange={(event) => {
                        const gains = [...eqGains];
                        gains[bandIndex] = Number(event.target.value);
                        setEqGains(gains);
                      }}
                      className="h-1.5 w-full min-w-0 cursor-pointer rounded-full"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="w-11 shrink-0 text-end text-[11px] tabular-nums text-muted">
                      {eqGains[bandIndex] > 0 ? "+" : ""}
                      {eqGains[bandIndex].toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Space modes */}
              <div className="mt-3.5 border-t border-separator pt-3">
                <p className="pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Space
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SPATIAL_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      title={mode.hint}
                      aria-pressed={spatialMode === mode.value}
                      onClick={() => setSpatialMode(mode.value as SpatialMode)}
                      className={cn(
                        "min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors duration-150",
                        spatialMode === mode.value
                          ? "border-transparent bg-accent text-accent-foreground"
                          : "border-separator bg-surface text-muted hover:text-foreground"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="glass relative rounded-t-field border border-b-0 border-separator p-2.5 shadow-pop sm:rounded-none sm:border-b-0 sm:p-0 lg:rounded-b-none lg:border-b-0">
            {/* ── Phone: row 1 = cover · title · play ───────────────── */}
            <div className="flex items-center gap-2.5 sm:hidden">
              <div className="relative size-11 flex-none overflow-hidden rounded-lg bg-surface-muted">
                {current.image ? (
                  <Image
                    src={current.image}
                    alt=""
                    width={96}
                    height={96}
                    sizes="48px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-faint-foreground">
                    <Music className="size-5" />
                  </span>
                )}
                {playing ? renderWave("absolute inset-0", "text-white") : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{current.title}</p>
                <p className="truncate text-xs text-muted">
                  {queueLabel ? `${queueLabel} · ` : ""}
                  {current.artist}
                </p>
                {/* Queue position stays visible on phones too. */}
                <p className="text-[10px] font-medium tabular-nums text-faint-foreground">
                  {index + 1} / {queue.length}
                  {playerError ? " · stream retry needed" : ""}
                </p>
              </div>
              {transport("sm")}
            </div>
            {/* ── Phone: row 2 = seek + EQ ─────────────────────────── */}
            <div className="mt-2 flex items-center gap-2 sm:hidden">
              {seekRow}
              <button
                type="button"
                title="Equalizer"
                aria-label="Equalizer"
                aria-expanded={eqOpen}
                onClick={() => setEqOpen((open) => !open)}
                className={cn(
                  "flex h-9 flex-none items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold transition-colors",
                  eqChipActive
                    ? "border-accent/40 bg-accent-soft text-brand"
                    : "border-separator text-muted hover:text-foreground"
                )}
              >
                <Sliders className="size-3.5" />
                EQ
              </button>
            </div>
            {playerError ? (
              <p className="mt-1 truncate text-[11px] text-danger sm:hidden">{playerError}</p>
            ) : null}

            {/* ── sm+: strict 3-column grid — details | transport | extras ── */}
            <div className="hidden items-center gap-4 px-3 py-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(300px,2.2fr)_minmax(0,1fr)] lg:gap-6 lg:px-4">
              {/* Zone 1 — track details, right-aligned content edge */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative size-12 flex-none overflow-hidden rounded-lg bg-surface-muted lg:size-13">
                  {current.image ? (
                    <Image
                      src={current.image}
                      alt=""
                      width={96}
                      height={96}
                      sizes="52px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-faint-foreground">
                      <Music className="size-5" />
                    </span>
                  )}
                  {playing ? renderWave("absolute inset-0", "text-white") : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground sm:max-w-36 lg:max-w-52">
                    {current.title}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {current.artist}
                    {queueLabel ? (
                      <span className="text-faint-foreground"> · {queueLabel}</span>
                    ) : null}
                  </p>
                  {playerError ? (
                    <p className="truncate text-[11px] text-danger">{playerError}</p>
                  ) : null}
                </div>
              </div>

              {/* Zone 2 — transport + seek, always visually centred */}
              <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-0.5">
                {transport("lg")}
                {seekRow}
              </div>

              {/* Zone 3 — EQ, queue position, volume, song page */}
              <div className="flex min-w-0 items-center justify-end gap-1 lg:gap-1.5">
                <span
                  className="hidden items-center gap-1.5 px-1 text-[11px] font-medium tabular-nums text-muted xl:flex"
                  title="Position in the queued list"
                >
                  <ListMusic className="size-3.5" />
                  {index + 1}/{queue.length}
                </span>
                <button
                  type="button"
                  title="Equalizer & space"
                  aria-label="Equalizer and space modes"
                  aria-expanded={eqOpen}
                  onClick={() => setEqOpen((open) => !open)}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors xl:px-3",
                    eqChipActive
                      ? "border-accent/40 bg-accent-soft text-brand"
                      : "border-separator text-muted hover:text-foreground"
                  )}
                >
                  <Sliders className="size-3.5" />
                  EQ
                </button>
                <button
                  type="button"
                  aria-label={muted ? "Unmute" : "Mute"}
                  title={muted ? "Unmute" : "Mute"}
                  onClick={() => setMuted(!muted)}
                  className="grid size-9 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  aria-label="Volume"
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-16 cursor-pointer rounded-full lg:w-24"
                  style={{ accentColor: "var(--accent)" }}
                />
                {current.pageUrl ? (
                  <a
                    href={current.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open song page"
                    aria-label="Open song page"
                    className="grid size-9 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bass hearing-safety confirmation */}
      {bassConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bass boost hearing warning"
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          onClick={() => setBassConfirm(false)}
        >
          <div
            className="glass w-full max-w-sm rounded-field border border-separator p-5 shadow-pop"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 pb-3">
              <span className="grid size-10 flex-none place-items-center rounded-full bg-warning-soft text-warning-soft-foreground">
                <AlertTriangle className="size-5" />
              </span>
              <p className="text-base font-bold text-foreground">Bass boost — ear check</p>
            </div>
            <p className="pb-1.5 text-sm leading-relaxed text-muted">
              Bass boost pushes the low frequencies hard. Extended listening at
              high volume — especially with boosted lows — can permanently
              damage your hearing.
            </p>
            <p className="pb-4 text-sm text-muted">Keep your volume moderate while it&apos;s on.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => setBassConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  applyPreset(
                    EQ_PRESETS.find((preset) => preset.label === BASS_PRESET_LABEL) ??
                      EQ_PRESETS[1]
                  );
                  setBassConfirm(false);
                }}
              >
                Enable bass boost
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
