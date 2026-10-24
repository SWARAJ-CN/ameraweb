"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  Film,
  Image as ImageIconD,
  Palette,
  RotateCcw,
  Scan,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Notice, Spinner } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";

/* ================================================================== *
 * Effect catalogue
 * ================================================================== */

interface Adjustments {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
  sepia: number;
  grayscale: number;
  invert: number;
  blur: number;
}

interface Grade {
  temperature: number; // -100 cool … +100 warm
  tint: number;        // -100 green … +100 magenta
  exposure: number;    // -100 … +100 (EV-ish)
  shadows: number;     // -100 … +100 lift/crush blacks
  highlights: number;  // -100 … +100 recover/boost whites
  vignette: number;    // 0 … 100 edge darkening
}

const DEFAULT_ADJUST: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0,
  blur: 0,
};

const DEFAULT_GRADE: Grade = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  shadows: 0,
  highlights: 0,
  vignette: 0,
};

const ADJUST_DEFS: Array<{ key: keyof Adjustments; label: string; min: number; max: number }> = [
  { key: "brightness", label: "Brightness", min: 20, max: 180 },
  { key: "contrast", label: "Contrast", min: 20, max: 200 },
  { key: "saturate", label: "Saturate", min: 0, max: 250 },
  { key: "hue", label: "Hue shift", min: 0, max: 360 },
  { key: "sepia", label: "Sepia", min: 0, max: 100 },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100 },
  { key: "invert", label: "Invert", min: 0, max: 100 },
  { key: "blur", label: "Blur", min: 0, max: 20 },
];

const GRADE_DEFS: Array<{ key: keyof Grade; label: string; min: number; max: number }> = [
  { key: "temperature", label: "Warmth", min: -100, max: 100 },
  { key: "tint", label: "Tint (M ↔ G)", min: -100, max: 100 },
  { key: "exposure", label: "Exposure", min: -100, max: 100 },
  { key: "shadows", label: "Shadows", min: -100, max: 100 },
  { key: "highlights", label: "Highlights", min: -100, max: 100 },
  { key: "vignette", label: "Vignette", min: 0, max: 100 },
];

/** 51 demo looks (applied as filter fragments under the grade pass). */
const PRESETS: string[] = [
  "",
  "brightness(1.08) saturate(0.9) contrast(0.94) blur(0.4px)",
  "sepia(0.32) saturate(1.25) brightness(1.06) hue-rotate(-8deg)",
  "sepia(0.55) contrast(0.92) brightness(0.98) saturate(0.8)",
  "grayscale(1) contrast(1.25) brightness(0.92)",
  "blur(1.2px) saturate(1.15) brightness(1.1) contrast(0.9)",
  "sepia(0.2) saturate(1.35) hue-rotate(-14deg) brightness(1.05)",
  "saturate(0.75) brightness(1.04) hue-rotate(12deg) contrast(0.96)",
  "sepia(0.28) contrast(1.1) saturate(0.88) hue-rotate(6deg)",
  "saturate(1.1) contrast(1.08) sepia(0.12) brightness(1.02)",
  "saturate(1.45) contrast(1.12) sepia(0.14)",
  "saturate(1.1) hue-rotate(-18deg) contrast(1.14) brightness(0.97)",
  "brightness(1.1) saturate(1.3) sepia(0.18) hue-rotate(-10deg)",
  "contrast(0.85) saturate(0.9) brightness(1.06)",
  "saturate(1.7) contrast(1.16) brightness(1.03)",
  "saturate(0.7) brightness(1.12) contrast(0.88) blur(0.3px)",
  "brightness(0.82) contrast(1.25) saturate(0.85)",
  "sepia(0.85) contrast(0.95) saturate(0.7) brightness(0.98)",
  "grayscale(0.6) contrast(1.08) brightness(0.98) hue-rotate(10deg)",
  "saturate(1.2) hue-rotate(36deg) contrast(1.06)",
  "brightness(1.06) saturate(1.05) hue-rotate(15deg) contrast(1.04)",
  "sepia(0.18) saturate(1.4) hue-rotate(-24deg) brightness(1.04)",
  "brightness(0.7) contrast(1.3) saturate(0.8) hue-rotate(4deg)",
  "sepia(0.24) brightness(1.1) saturate(0.85) contrast(0.92)",
  "contrast(1.2) saturate(1.15) brightness(1.02)",
  "contrast(0.8) brightness(1.08) saturate(0.82)",
  "hue-rotate(180deg) saturate(1.4)",
  "grayscale(1) invert(1) contrast(1.15)",
  "invert(0.9) sepia(0.4) hue-rotate(160deg) saturate(1.6)",
  "grayscale(1) sepia(0.6) hue-rotate(190deg) saturate(2)",
  "grayscale(1) sepia(0.7) hue-rotate(-20deg) saturate(2.2)",
  "grayscale(1) sepia(0.5) hue-rotate(60deg) saturate(2.4)",
  "grayscale(1) sepia(0.65) hue-rotate(230deg) saturate(2.2)",
  "brightness(0.92) saturate(0.7) contrast(1.05) blur(0.6px)",
  "saturate(1.5) hue-rotate(-6deg) brightness(1.05) contrast(1.05)",
  "brightness(1.15) saturate(0.55) contrast(1.02) hue-rotate(8deg)",
  "sepia(0.42) saturate(1.35) hue-rotate(-18deg) brightness(1.0)",
  "saturate(1.2) hue-rotate(-32deg) brightness(1.06) blur(0.3px)",
  "saturate(1.25) hue-rotate(24deg) contrast(1.08) brightness(0.98)",
  "hue-rotate(48deg) saturate(1.35) contrast(1.12) brightness(0.9)",
  "blur(0.8px) brightness(1.14) saturate(0.75) contrast(0.9)",
  "contrast(1.22) saturate(1.1) brightness(0.95) hue-rotate(10deg)",
  "sepia(0.75) grayscale(0.3) contrast(1.05)",
  "grayscale(0.9) contrast(1.12) brightness(1.02)",
  "sepia(0.55) hue-rotate(-6deg) saturate(1.3) contrast(1.08)",
  "brightness(1.12) sepia(0.2) saturate(0.9) contrast(0.9)",
  "brightness(0.85) saturate(1.2) hue-rotate(22deg) contrast(1.15)",
  "grayscale(0.75) contrast(1.06) brightness(1.01)",
  "brightness(0.75) contrast(1.28) saturate(1.4) hue-rotate(28deg)",
  "saturate(1.05) contrast(1.02) sepia(0.06)",
  "contrast(1.35) saturate(1.6) sepia(0.1) brightness(0.96)",
];

type Ratio = "auto" | "square" | "portrait" | "story";

const RATIO_OPTIONS: Array<{ value: Ratio; label: string; hint: string }> = [
  { value: "auto", label: "Original", hint: "Keep the photo's own shape" },
  { value: "square", label: "1:1", hint: "Classic post square" },
  { value: "portrait", label: "4:5", hint: "Portrait post" },
  { value: "story", label: "9:16", hint: "Instagram story" },
];

const EXPORT_SIZE: Record<Exclude<Ratio, "auto">, [number, number]> = {
  square: [1440, 1440],
  portrait: [1080, 1350],
  story: [1080, 1920],
};

/** Story video render size (9:16). */
const STORY_VIDEO: [number, number] = [720, 1280];

type Panel = "filters" | "adjust" | "grade";

/** SVG id for the grading pass — referenced from both the CSS preview and
 *  the canvas export (`ctx.filter` supports url() in Chromium). */
const GRADE_FILTER_ID = "amare-studio-grade";

/* ================================================================== *
 * ImageStudio
 * ================================================================== */

interface ImageStudioProps {
  externalSource?: string | null;
  onClearExternal?: () => void;
  className?: string;
}

export function ImageStudio({
  externalSource,
  onClearExternal,
  className,
}: ImageStudioProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const source = picked ?? externalSource ?? null;
  const isFromExternal =
    picked === null && externalSource !== null && externalSource !== undefined;

  const [panel, setPanel] = useState<Panel>("filters");
  const [ratio, setRatio] = useState<Ratio>("auto");
  const [upscale, setUpscale] = useState<1 | 2 | 4>(1);
  const [adjust, setAdjust] = useState<Adjustments>(DEFAULT_ADJUST);
  const [grade, setGrade] = useState<Grade>(DEFAULT_GRADE);
  const [presetIndex, setPresetIndex] = useState(0);
  const [split, setSplit] = useState(50);
  const [exportError, setExportError] = useState<string | null>(null);

  // Story video state
  const [durationSec, setDurationSec] = useState(30);
  const [videoState, setVideoState] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const recordingRef = useRef(false);

  useEffect(
    () => () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    },
    []
  );

  const adjustFilter = useMemo(() => {
    const parts: string[] = [];
    if (adjust.brightness !== 100) parts.push(`brightness(${adjust.brightness}%)`);
    if (adjust.contrast !== 100) parts.push(`contrast(${adjust.contrast}%)`);
    if (adjust.saturate !== 100) parts.push(`saturate(${adjust.saturate}%)`);
    if (adjust.hue !== 0) parts.push(`hue-rotate(${adjust.hue}deg)`);
    if (adjust.sepia !== 0) parts.push(`sepia(${adjust.sepia}%)`);
    if (adjust.grayscale !== 0) parts.push(`grayscale(${adjust.grayscale}%)`);
    if (adjust.invert !== 0) parts.push(`invert(${adjust.invert}%)`);
    if (adjust.blur !== 0) parts.push(`blur(${adjust.blur}px)`);
    return parts.join(" ");
  }, [adjust]);

  const cssFilter = [PRESETS[presetIndex], adjustFilter].filter(Boolean).join(" ");
  const gradeActive =
    grade.temperature !== 0 ||
    grade.tint !== 0 ||
    grade.exposure !== 0 ||
    grade.shadows !== 0 ||
    grade.highlights !== 0 ||
    grade.vignette !== 0;
  const finalFilter = gradeActive ? `${cssFilter || "none"} url(#${GRADE_FILTER_ID})` : cssFilter;

  /* ---------- grade → SVG filter values (shared by preview + export) ---------- */

  const gradeMatrix = useMemo(() => {
    const t = grade.temperature / 100;
    const n = grade.tint / 100;
    const rg = 1 + 0.18 * t + 0.09 * n;
    const gg = 1 - 0.15 * n;
    const bg = 1 - 0.18 * t + 0.09 * n;
    return `${rg.toFixed(3)} 0 0 0 0  0 ${gg.toFixed(3)} 0 0 0  0 0 ${bg.toFixed(3)} 0 0  0 0 0 1 0`;
  }, [grade.temperature, grade.tint]);

  /** Tone curve: exposure multiplier + shadow lift/crush + highlight gains. */
  const curveTables = useMemo<[string, string, string]>(() => {
    const ev = Math.pow(2, grade.exposure / 150);
    const sh = grade.shadows / 100;
    const hi = grade.highlights / 100;
    const map = (v: number) => {
      let out = v * ev;
      out += sh * Math.pow(1 - v, 2);
      out += hi * Math.pow(v, 2);
      return out < 0 ? 0 : out > 1 ? 1 : out;
    };
    const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map(map).map((value) => value.toFixed(4));
    const table = points.join(" ");
    return [table, table, table];
  }, [grade.exposure, grade.shadows, grade.highlights]);

  /* ---------------- rendering helpers ---------------- */

  const drawFrame = useCallback(
    (
      img: HTMLImageElement,
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      zoom: number
    ) => {
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight) * zoom;
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      context.save();
      context.filter = finalFilter || "none";
      context.clearRect(0, 0, width, height);
      context.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
      if (grade.vignette > 0) {
        context.filter = "none";
        const cx = width / 2;
        const cy = height / 2;
        const inner = Math.min(width, height) * 0.48;
        const outer = Math.max(width, height) * 0.72;
        const gradient = context.createRadialGradient(cx, cy, inner, cx, cy, outer);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${(grade.vignette / 100) * 0.65})`);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }
      context.restore();
    },
    [finalFilter, grade.vignette]
  );

  const loadSource = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("The image could not be loaded."));
      img.src = src;
    });
  }, []);

  const exportBox = useCallback(
    (img: HTMLImageElement): [number, number] => {
      let width: number;
      let height: number;
      if (ratio === "auto") {
        const scale = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
        width = Math.round(img.naturalWidth * scale);
        height = Math.round(img.naturalHeight * scale);
      } else {
        [width, height] = EXPORT_SIZE[ratio];
      }
      // Quality upscale multiplies the base box (capped for browser safety).
      const cap = 4096;
      const scale = Math.min(upscale, cap / Math.max(width, height));
      if (scale < 1) return [Math.round(width * scale), Math.round(height * scale)];
      const outW = Math.round(width * upscale);
      return [Math.min(outW, cap), Math.min(Math.round((Math.min(outW, cap) * height) / width), cap)];
    },
    [ratio, upscale]
  );

  /** Edit → crop → (optional) stepwise high-quality upscale → vignette → PNG. */
  const exportPng = useCallback(async () => {
    if (!source) return;
    setExportError(null);
    try {
      const img = await loadSource(source);
      const [width, height] = exportBox(img);
      // Base pass at the crop box, then ≤2× jumps with high smoothing —
      // the classic bicubic-stepwise upscale that keeps edges clean.
      const baseW = Math.min(width, 2048);
      const baseH = Math.max(1, Math.round((baseW * height) / width));
      let current: HTMLCanvasElement | HTMLImageElement = img;

      const baseCanvas = document.createElement("canvas");
      baseCanvas.width = baseW;
      baseCanvas.height = baseH;
      const baseCtx = baseCanvas.getContext("2d");
      if (!baseCtx) throw new Error("Canvas unavailable.");
      drawFrame(img, baseCtx, baseW, baseH, 1);
      current = baseCanvas;

      while ((current as HTMLCanvasElement).width * 2 <= width) {
        const next = document.createElement("canvas");
        next.width = (current as HTMLCanvasElement).width * 2;
        next.height = (current as HTMLCanvasElement).height * 2;
        const ctx = next.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(current, 0, 0, next.width, next.height);
        current = next;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(current, 0, 0, width, height);
      if (grade.vignette > 0) {
        const cx = width / 2;
        const cy = height / 2;
        const inner = Math.min(width, height) * 0.48;
        const outer = Math.max(width, height) * 0.72;
        const gradient = context.createRadialGradient(cx, cy, inner, cx, cy, outer);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${(grade.vignette / 100) * 0.65})`);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Export failed — try again.");
      const url = URL.createObjectURL(blob);
      const label = RATIO_OPTIONS.find((option) => option.value === ratio)?.label ?? "photo";
      const link = document.createElement("a");
      link.href = url;
      link.download = `amare-edited-${label.replace(":", "")}${upscale > 1 ? `-x${upscale}` : ""}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      void baseCanvas;
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Export failed.");
    }
  }, [drawFrame, exportBox, grade.vignette, loadSource, ratio, source, upscale]);

  /* ---------------- story video ---------------- */

  const videoMime = useMemo(() => {
    if (typeof MediaRecorder === "undefined") return "";
    return (
      ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
        (option) => MediaRecorder.isTypeSupported(option)
      ) ?? ""
    );
  }, []);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
  }, []);

  const makeStoryVideo = useCallback(async () => {
    if (!source) return;
    if (!videoMime) {
      setVideoError("This browser can't record canvas video — try desktop Chrome.");
      setVideoState("error");
      return;
    }
    setVideoError(null);
    setVideoState("recording");
    setVideoProgress(0);

    try {
      const img = await loadSource(source);
      const [width, height] = STORY_VIDEO;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable.");
      drawFrame(img, context, width, height, 1.02);

      const canvasStream = canvas.captureStream(24);
      const recorder = new MediaRecorder(canvasStream, { mimeType: videoMime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const done = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
        recorder.onerror = () => reject(new Error("Recording failed midway."));
      });

      const startedAt = performance.now();
      const tick = window.setInterval(() => {
        const elapsed = (performance.now() - startedAt) / 1000;
        const zoom = 1.02 + 0.1 * Math.min(elapsed / durationSec, 1);
        drawFrame(img, context, width, height, zoom);
        setVideoProgress(Math.min(elapsed / durationSec, 1));
        if (!recordingRef.current || elapsed >= durationSec) {
          window.clearInterval(tick);
          if (recorder.state !== "inactive") recorder.stop();
        }
      }, 100);

      recordingRef.current = true;
      recorder.start(500);
      const blob = await done;
      if (blob.size === 0) {
        throw new Error("Recording was stopped before any frames landed.");
      }
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = URL.createObjectURL(blob);
      setVideoUrl(videoUrlRef.current);
      setVideoState("done");
      setVideoProgress(1);
    } catch (cause) {
      if (cause instanceof DOMException) return;
      setVideoError(cause instanceof Error ? cause.message : "Video failed.");
      setVideoState("error");
    } finally {
      recordingRef.current = false;
    }
  }, [durationSec, drawFrame, loadSource, source, videoMime]);

  const recordLabel =
    videoState === "recording"
      ? `Recording ${Math.round(videoProgress * durationSec)}s / ${durationSec}s…`
      : `Render ${durationSec}s story`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* The subtle SVG grade filter lives once in the document. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id={GRADE_FILTER_ID} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={gradeMatrix} />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={curveTables[0]} />
            <feFuncG type="table" tableValues={curveTables[1]} />
            <feFuncB type="table" tableValues={curveTables[2]} />
          </feComponentTransfer>
        </filter>
      </svg>

      {!source ? (
        <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-field border-2 border-dashed border-separator bg-surface text-center transition-colors hover:border-accent/60">
          <ImageIconD className="size-8 text-faint-foreground" />
          <span className="text-base font-semibold">Open the editor with a photo…</span>
          <span className="text-xs text-faint-foreground">
            JPG · PNG · WEBP — or send one over from Bg Remove
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setPicked(URL.createObjectURL(file));
                setVideoState("idle");
                setVideoUrl(null);
              }
            }}
          />
        </label>
      ) : (
        <Card>
          <CardHeader
            title="Editor"
            description="Live canvas · looks, fine tune & color grade · crop, upscale, story export."
            actions={
              <button
                type="button"
                onClick={() => {
                  setAdjust(DEFAULT_ADJUST);
                  setGrade(DEFAULT_GRADE);
                  setPresetIndex(0);
                  setRatio("auto");
                  setUpscale(1);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3" /> Reset all
              </button>
            }
          />
          <CardContent className="flex flex-col gap-3">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex w-full flex-wrap items-center gap-1.5 lg:w-auto">
                {RATIO_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    aria-pressed={ratio === option.value}
                    onClick={() => setRatio(option.value)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                      ratio === option.value
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-separator bg-surface text-muted hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                <span className="text-[11px] text-faint-foreground">crop</span>
              </div>
            </div>

            {/* Workspace: icon rail · canvas · side rail */}
            <div className="grid items-start gap-3 lg:grid-cols-[3rem_minmax(0,1fr)_20rem]">
              {/* Icon rail (left) */}
              <div className="flex gap-1 lg:flex-col">
                {(
                  [
                    { key: "filters", icon: Sparkles, label: "Looks" },
                    { key: "adjust", icon: SlidersHorizontal, label: "Adjust" },
                    { key: "grade", icon: Palette, label: "Color" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    title={item.label}
                    aria-pressed={panel === item.key}
                    onClick={() => setPanel(item.key as Panel)}
                    className={cn(
                      "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-field border text-xs font-semibold transition-colors lg:flex-none lg:w-full lg:min-h-12",
                      panel === item.key
                        ? "border-accent/40 bg-accent-soft text-brand"
                        : "border-separator bg-surface text-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4" />
                    <span className="lg:hidden">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Canvas */}
              <div className="flex flex-col gap-2">
                <div className="relative mx-auto w-full max-w-3xl select-none overflow-hidden rounded-field border border-separator bg-surface-muted shadow-field">
                  <img
                    src={source}
                    alt="Original"
                    className="block max-h-[62vh] w-full object-contain"
                  />
                  <img
                    src={source}
                    alt="Edited"
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{
                      filter: finalFilter || "none",
                      clipPath: `inset(0 ${100 - split}% 0 0)`,
                    }}
                  />
                  {/* Vignette preview overlay (below the divider clip) */}
                  {grade.vignette > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${Math.max(30, 60 - grade.vignette / 4)}%, rgba(0,0,0,${(grade.vignette / 100) * 0.65}) 100%)`,
                        clipPath: `inset(0 ${100 - split}% 0 0)`,
                      }}
                    />
                  ) : null}
                  <span
                    className="absolute inset-y-0 z-10 w-0.5 bg-white/90 shadow-sm"
                    style={{ insetInlineStart: `${split}%` }}
                  />
                  <span className="absolute start-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    BEFORE
                  </span>
                  <span className="absolute end-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    AFTER
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={split}
                  aria-label="Before after split"
                  onChange={(event) => setSplit(Number(event.target.value))}
                  className="h-1.5 w-full cursor-ew-resize rounded-full"
                  style={{ accentColor: "var(--accent)" }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="md" onClick={exportPng}>
                    <Download className="size-4" /> Download PNG
                  </Button>
                  <div className="flex items-center gap-1.5 rounded-field border border-separator bg-surface px-2 py-1">
                    <Scan className="size-3.5 text-muted" />
                    <span className="text-[11px] font-semibold text-muted-foreground">Upscale</span>
                    {([1, 2, 4] as const).map((factor) => (
                      <button
                        key={factor}
                        type="button"
                        title={
                          factor === 1
                            ? "Native quality"
                            : `${factor}× high-quality stepwise upscale`
                        }
                        aria-pressed={upscale === factor}
                        onClick={() => setUpscale(factor)}
                        className={cn(
                          "min-h-7 rounded-full border px-2 text-[11px] font-semibold transition-colors",
                          upscale === factor
                            ? "border-transparent bg-accent text-accent-foreground"
                            : "border-transparent text-muted hover:text-foreground"
                        )}
                      >
                        {factor}×
                      </button>
                    ))}
                  </div>
                  {isFromExternal && onClearExternal ? (
                    <Button variant="ghost" size="md" onClick={onClearExternal}>
                      <X className="size-4" /> Close external
                    </Button>
                  ) : (
                    <Button variant="ghost" size="md" onClick={() => setPicked(null)}>
                      Change photo
                    </Button>
                  )}
                  {exportError ? (
                    <span className="text-xs text-danger">{exportError}</span>
                  ) : null}
                </div>
              </div>

              {/* Side rail */}
              <div
                className={cn(
                  "flex flex-col gap-3 lg:max-h-[74vh] lg:overflow-y-auto lg:pe-1"
                )}
              >
                <div className={cn("flex flex-col gap-2", panel !== "filters" && "hidden lg:flex")}>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {PRESETS.length} looks
                  </p>
                  <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">
                    {PRESETS.map((candidate, index) => (
                      <button
                        key={index}
                        type="button"
                        title={index === 0 ? "Original" : `Look ${index}`}
                        aria-label={index === 0 ? "Original" : `Look ${index}`}
                        aria-pressed={presetIndex === index}
                        onClick={() => setPresetIndex(index)}
                        className={cn(
                          "relative aspect-square h-auto w-full overflow-hidden rounded-lg border-2 bg-surface-muted transition-all duration-200 hover:scale-[1.03]",
                          presetIndex === index ? "border-accent shadow-pop" : "border-transparent"
                        )}
                      >
                        <img
                          src={source}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ filter: candidate || "none" }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adjust */}
                <div className={cn("flex flex-col gap-2.5", panel !== "adjust" && "hidden lg:flex")}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Fine tune
                    </p>
                    <button
                      type="button"
                      onClick={() => setAdjust(DEFAULT_ADJUST)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  </div>
                  {ADJUST_DEFS.map((definition) => (
                    <SliderRow
                      key={definition.key}
                      label={definition.label}
                      min={definition.min}
                      max={definition.max}
                      step={definition.key === "blur" ? 0.5 : 1}
                      value={adjust[definition.key]}
                      onChange={(value) =>
                        setAdjust((prev) => ({ ...prev, [definition.key]: value }))
                      }
                    />
                  ))}
                </div>

                {/* Grade */}
                <div className={cn("flex flex-col gap-2.5 rounded-field border border-separator bg-surface p-3", panel !== "grade" && "hidden lg:flex")}>
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Palette className="size-3.5" /> Color grade
                    </p>
                    <button
                      type="button"
                      onClick={() => setGrade(DEFAULT_GRADE)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  </div>
                  {GRADE_DEFS.map((definition) => (
                    <SliderRow
                      key={definition.key}
                      label={definition.label}
                      min={definition.min}
                      max={definition.max}
                      step={1}
                      value={grade[definition.key]}
                      onChange={(value) => setGrade((prev) => ({ ...prev, [definition.key]: value }))}
                    />
                  ))}
                  <p className="text-[10px] leading-relaxed text-faint-foreground">
                    Warmth & tint run a color matrix; exposure, shadows &
                    highlights run a tone curve — applied to the preview and to
                    PNG/story exports alike.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instagram story studio */}
      {source ? (
        <Card>
          <CardHeader
            title="Instagram story studio"
            description={`9:16 (${STORY_VIDEO[0]}×${STORY_VIDEO[1]}) — the edited photo becomes a downloadable story video.`}
            actions={videoState === "recording" ? <Spinner className="size-4" /> : null}
          />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Length
              </span>
              {[10, 20, 30].map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  aria-pressed={durationSec === seconds}
                  onClick={() => setDurationSec(seconds)}
                  className={cn(
                    "min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                    durationSec === seconds
                      ? "border-transparent bg-accent text-accent-foreground"
                      : "border-separator bg-surface text-muted hover:text-foreground"
                  )}
                >
                  {seconds}s
                </button>
              ))}
              <span
                title="Instagram story ratio"
                className="ms-auto rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-brand"
              >
                9:16 · {STORY_VIDEO[0]}×{STORY_VIDEO[1]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={makeStoryVideo}
                disabled={videoState === "recording"}
              >
                {videoState === "recording" ? (
                  <>
                    <Spinner className="size-4" /> {recordLabel}
                  </>
                ) : (
                  <>
                    <Film className="size-4" /> {recordLabel}
                  </>
                )}
              </Button>
              {videoState === "recording" ? (
                <>
                  <Button variant="ghost" size="md" onClick={stopRecording}>
                    Stop early
                  </Button>
                  <span
                    className="h-1.5 w-28 rounded-full bg-surface-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={durationSec}
                    aria-valuenow={Math.round(videoProgress * durationSec)}
                  >
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${videoProgress * 100}%` }}
                    />
                  </span>
                </>
              ) : null}
              {videoUrl ? (
                <a
                  href={videoUrl}
                  download="amare-story.webm"
                  className={buttonClasses("secondary", "md")}
                >
                  <Download className="size-4" /> Download story
                </a>
              ) : null}
            </div>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="mx-auto max-h-80 w-auto max-w-full rounded-lg border border-separator bg-black"
              />
            ) : null}
            {videoError ? (
              <Notice tone="warning" title="Video failed">
                {videoError}
              </Notice>
            ) : null}
            <p className="text-[11px] text-faint-foreground">
              Renders fully in your browser as a silent WebM (VP9) story video.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] font-medium text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full min-w-0 cursor-pointer rounded-full"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="w-11 shrink-0 text-end text-[11px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

