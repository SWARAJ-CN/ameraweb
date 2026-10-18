"use client";

import { useEffect, useRef } from "react";

/** Columns drawn across the meter. */
const BARS = 44;
/** Fraction of a bar's height it drops each frame when the sound stops. */
const DECAY = 0.14;
/** Recognition gets the microphone first; the meter follows a beat later. */
const START_DELAY_MS = 400;

/**
 * Live view of what the microphone is picking up.
 *
 * Speech recognition gives us no audio, so this opens its own capture and draws
 * the spectrum. That makes it a second consumer of the same device, which is
 * not guaranteed on every platform — so it is strictly optional: if the stream
 * cannot be opened the meter silently draws nothing and recognition carries on
 * untouched.
 *
 * Drawing is done on a canvas from inside the animation frame rather than
 * through React state, so a 60 fps meter costs no re-renders.
 */
export function VoiceMeter({ active, className }: { active: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let bins: Uint8Array<ArrayBuffer> | null = null;
    let colour = "currentColor";
    let stopped = false;
    const levels = new Float32Array(BARS);

    const render = () => {
      if (stopped) return;
      frame = window.requestAnimationFrame(render);

      const canvas = canvasRef.current;
      const meter = analyser;
      const data = bins;
      if (!canvas || !meter || !data) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      meter.getByteFrequencyData(data);

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
      if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);

      const paint = canvas.getContext("2d");
      if (!paint) return;
      paint.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint.clearRect(0, 0, width, height);
      paint.fillStyle = colour;

      // Speech lives low in the spectrum, so the top of the range is ignored.
      const usable = Math.max(BARS, Math.floor(data.length * 0.6));
      const step = width / BARS;

      for (let i = 0; i < BARS; i += 1) {
        const from = Math.floor((i / BARS) * usable);
        const to = Math.max(from + 1, Math.floor(((i + 1) / BARS) * usable));
        let sum = 0;
        for (let j = from; j < to; j += 1) sum += data[j];
        const level = sum / (to - from) / 255;

        // Rise instantly, fall smoothly, so the meter reads as movement.
        levels[i] = level > levels[i] ? level : levels[i] * (1 - DECAY);

        const barHeight = Math.max(1.5, levels[i] * height);
        paint.fillRect(i * step + step * 0.2, height - barHeight, step * 0.6, barHeight);
      }
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const scope = window as unknown as { webkitAudioContext?: typeof AudioContext };
        const AudioContextClass = window.AudioContext ?? scope.webkitAudioContext;
        if (!AudioContextClass) return;

        context = new AudioContextClass();
        await context.resume().catch(() => undefined);

        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        context.createMediaStreamSource(stream).connect(analyser);
        bins = new Uint8Array(analyser.frequencyBinCount);

        const canvas = canvasRef.current;
        if (canvas) colour = window.getComputedStyle(canvas).color || colour;

        frame = window.requestAnimationFrame(render);
      } catch {
        /* the meter is a bonus — recognition never depends on it */
      }
    };

    const timer = window.setTimeout(() => void start(), START_DELAY_MS);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => undefined);
    };
  }, [active]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
