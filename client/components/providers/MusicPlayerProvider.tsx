"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Song } from "@/lib/saavn";

/* ------------------------------------------------------------------ *
 * Equalizer — five peaking filters wired into the Web Audio graph.
 * ------------------------------------------------------------------ */
export const EQ_BANDS = [
  { frequency: 60, label: "60" },
  { frequency: 225, label: "225" },
  { frequency: 1000, label: "1k" },
  { frequency: 3800, label: "3.8k" },
  { frequency: 14000, label: "14k" },
];

export interface EqPreset {
  label: string;
  gains: number[];
}

export const EQ_PRESETS: EqPreset[] = [
  { label: "Flat", gains: [0, 0, 0, 0, 0] },
  { label: "Bass boost", gains: [8, 5, 0, -1, 0] },
  { label: "Vocal", gains: [-3, 0, 3.5, 4, 0] },
  { label: "Treble", gains: [0, -2, 0, 3.5, 7] },
  { label: "Party", gains: [6, 2, 2, 4, 5] },
  { label: "Soft", gains: [-4, -2, 1, 2, -3] },
];

export const BASS_PRESET_LABEL = "Bass boost";

/** Immersive playback modes wired in between the EQ and the analyser. */
export type SpatialMode = "off" | "stereo" | "mono" | "8d" | "3d" | "surround";

export const SPATIAL_MODES: Array<{ value: SpatialMode; label: string; hint: string }> = [
  { value: "off", label: "Off", hint: "Raw stream" },
  { value: "stereo", label: "Stereo", hint: "Standard two-channel" },
  { value: "mono", label: "Mono", hint: "Both channels summed" },
  { value: "8d", label: "8D", hint: "Slow orbit around your head" },
  { value: "3d", label: "3D", hint: "HRTF room feel" },
  { value: "surround", label: "Surround", hint: "Widened stereo field" },
];

interface MusicPlayerValue {
  queue: Song[];
  queueLabel: string;
  index: number;
  current: Song | null;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  playerError: string | null;
  visualizerReady: boolean;
  eqPreset: string;
  eqGains: number[];
  spatialMode: SpatialMode;
  getAnalyser: () => AnalyserNode | null;
  startQueue: (list: Song[], label: string, position: number) => void;
  togglePlay: () => void;
  stepTrack: (direction: 1 | -1) => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  applyPreset: (preset: EqPreset) => void;
  setEqGains: (gains: number[]) => void;
  setSpatialMode: (mode: SpatialMode) => void;
}

const MusicPlayerContext = createContext<MusicPlayerValue | null>(null);

/**
 * App-wide music playback.
 *
 * Lives beside the data providers (not inside /music) so the queue and the
 * <audio> element survive page navigation — switching tabs keeps the music
 * running, and Chrome's background tab continues it too. MediaSession hooks
 * hand the OS lock screen / mini-player controls.
 */
export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueLabel, setQueueLabel] = useState("");
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [muted, setMutedState] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [eqPreset, setEqPreset] = useState<string>("Flat");
  const [eqGains, setEqGains] = useState<number[]>(EQ_PRESETS[0].gains);
  const [spatialMode, setSpatialModeState] = useState<SpatialMode>("off");
  const [visualizerReady, setVisualizerReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const eqGainsRef = useRef<number[]>(eqGains);
  /** Fixed entry/exit gains that the spatial FX rewire between. */
  const spaceInRef = useRef<GainNode | null>(null);
  const spaceOutRef = useRef<GainNode | null>(null);
  /** Stops LFOs / disconnects the current spatial chain. */
  const spatialCleanupRef = useRef<() => void>(() => {});
  const spatialModeRef = useRef<SpatialMode>("off");
  /** CORS probe cache: hostname → analyser allowed. */
  const corsCacheRef = useRef<Map<string, boolean>>(new Map());
  // Play intent is read at track-switch time; state would force the loader
  // effect to re-run on clicks.
  const shouldPlayRef = useRef(false);

  useEffect(() => {
    eqGainsRef.current = eqGains;
  }, [eqGains]);

  const current = queue[index] ?? null;

  const getAnalyser = useCallback(() => analyserRef.current, []);

  // CORS check — the visualizer needs the stream to be readable from JS.
  const probeCors = useCallback(async (url: string, hostname: string): Promise<boolean> => {
    const cached = corsCacheRef.current.get(hostname);
    if (cached !== undefined) return cached;
    let allowed = false;
    try {
      const response = await fetch(url, { method: "HEAD", mode: "cors" });
      allowed = response.ok;
    } catch {
      allowed = false;
    }
    corsCacheRef.current.set(hostname, allowed);
    return allowed;
  }, []);

  /**
   * Rewires the spatial section between `spaceIn` and `spaceOut` for the
   * active mode the EQ feeds the section and the analyser listens after it,
   * so the wave visualiser reflects every effect.
   */
  const applySpatial = useCallback(() => {
    const context = audioContextRef.current;
    const input = spaceInRef.current;
    const output = spaceOutRef.current;
    if (!context || !input || !output) return;

    spatialCleanupRef.current();
    spatialCleanupRef.current = () => {};
    input.disconnect();

    const mode = spatialModeRef.current;
    if (mode === "off" || mode === "stereo") {
      // "Stereo" is the deliberate pass-through mode (same signal path as
      // off, minus the automatic shortcut).
      input.connect(output);
      return;
    }

    try {
      if (mode === "mono") {
        // Sum both halves into one bus; halve each so the sum can't clip.
        const splitter = context.createChannelSplitter(2);
        const sum = context.createGain();
        const halfL = context.createGain();
        const halfR = context.createGain();
        halfL.gain.value = 0.5;
        halfR.gain.value = 0.5;
        splitter.connect(halfL, 0);
        splitter.connect(halfR, 1);
        halfL.connect(sum);
        halfR.connect(sum);
        input.connect(splitter);
        sum.connect(output);
        spatialCleanupRef.current = () => {
          try {
            splitter.disconnect();
            halfL.disconnect();
            halfR.disconnect();
            sum.disconnect();
          } catch {
            // already disconnected
          }
        };
        return;
      }

      if (mode === "8d") {
        // Slow circular orbit: a sub-0.1 Hz sine breathes the stereo pan.
        const panner = context.createStereoPanner();
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.08;
        depth.gain.value = 0.95;
        lfo.connect(depth);
        depth.connect(panner.pan);
        input.connect(panner);
        panner.connect(output);
        lfo.start();
        spatialCleanupRef.current = () => {
          try {
            lfo.stop();
            lfo.disconnect();
            depth.disconnect();
            panner.disconnect();
          } catch {
            // already stopped
          }
        };
        return;
      }

      if (mode === "3d") {
        // HRTF binaural placement with a gentle lateral drift.
        const panner = context.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 0.5;
        panner.rolloffFactor = 0.4;
        panner.positionZ.value = -0.9;
        panner.positionY.value = -0.1;
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.05;
        depth.gain.value = 1.8;
        lfo.connect(depth);
        depth.connect(panner.positionX);
        input.connect(panner);
        panner.connect(output);
        lfo.start();
        spatialCleanupRef.current = () => {
          try {
            lfo.stop();
            lfo.disconnect();
            depth.disconnect();
            panner.disconnect();
          } catch {
            // already stopped
          }
        };
        return;
      }

      // Surround: cross-bled Haas widener — each side hears a slightly
      // delayed ghost of the other, doubling the perceived stage width.
      const splitter = context.createChannelSplitter(2);
      const merger = context.createChannelMerger(2);
      const bleedDelay = context.createDelay(0.05);
      bleedDelay.delayTime.value = 0.018;
      const bleedGain = context.createGain();
      bleedGain.gain.value = 0.55;

      input.connect(splitter);
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 1);
      splitter.connect(bleedDelay, 0);
      bleedDelay.connect(bleedGain);
      bleedGain.connect(merger, 0, 1);
      merger.connect(output);
      spatialCleanupRef.current = () => {
        try {
          splitter.disconnect();
          bleedDelay.disconnect();
          bleedGain.disconnect();
          merger.disconnect();
        } catch {
          // already disconnected
        }
      };
    } catch {
      // Node types unavailable — stay silent-equivalent (direct).
      input.connect(output);
    }
  }, []);

  /**
   * Wires the audio graph exactly once: element → EQ filters → analyser →
   * output. Creating a MediaElementSource twice throws, so this is guarded by
   * the context ref.
   */
  const ensureGraph = useCallback((): AnalyserNode | null => {
    const audio = audioRef.current;
    if (!audio || audioContextRef.current) return analyserRef.current;
    const Context = window.AudioContext ?? (
      window as unknown as { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;
    if (!Context) return null;
    try {
      const context = new Context();
      const source = context.createMediaElementSource(audio);
      const filters = EQ_BANDS.map((band, bandIndex) => {
        const filter = context.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = band.frequency;
        filter.Q.value = 1;
        filter.gain.value = eqGainsRef.current[bandIndex];
        return filter;
      });
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const spaceIn = context.createGain();
      const spaceOut = context.createGain();

      let node: AudioNode = source;
      for (const filter of filters) {
        node.connect(filter);
        node = filter;
      }
      node.connect(spaceIn);
      spaceOut.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      filtersRef.current = filters;
      analyserRef.current = analyser;
      spaceInRef.current = spaceIn;
      spaceOutRef.current = spaceOut;
      applySpatial();
      return analyser;
    } catch {
      analyserRef.current = null;
      return null;
    }
    // applySpatial is stable (no deps) — the hook linter's link-fix heuristic
    // missed the forward reference, so it's listed manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply EQ changes live, whether or not the graph has been created yet.
  useEffect(() => {
    filtersRef.current.forEach((filter, filterIndex) => {
      filter.gain.value = eqGains[filterIndex];
    });
  }, [eqGains]);

  // Load a fresh stream whenever the active track changes. The play path is
  // async because the analyser needs a CORS check on the stream host first.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    let cancelled = false;

    setProgress(0);
    setDuration(current.duration || 0);
    setPlayerError(null);

    const startStream = async () => {
      let hostname = "";
      try {
        hostname = new URL(current.streamUrl).hostname;
      } catch {
        // Unusual but possible; treat as non-analyserable.
      }
      const cors = hostname ? await probeCors(current.streamUrl, hostname) : false;
      if (cancelled) return;

      if (cors) {
        // The analyser only sees data with crossorigin="anonymous".
        audio.crossOrigin = "anonymous";
      } else {
        audio.crossOrigin = null;
      }
      // The graph (EQ + spatial FX) is built regardless — a CORS-blocked
      // stream still perks through Web Audio, it just can't be analysed.
      setVisualizerReady(cors && Boolean(ensureGraph()));
      audio.src = current.streamUrl;
      audio.load();
      if (shouldPlayRef.current) {
        audioContextRef.current?.resume().catch(() => {});
        audio.play().catch(() => {
          setPlayerError("Streaming was interrupted — press play to retry.");
          setPlaying(false);
        });
      }
    };

    void startStream();
    return () => {
      cancelled = true;
    };
    // The track id is the real trigger; `shouldPlayRef` is consumed above at
    // switch time and re-running on its change would restart finished tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Keep the element's volume/mute in sync with the controls.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
    }
  }, [volume, muted]);

  // Release the audio graph when the provider unmounts (page teardown).
  useEffect(
    () => () => {
      spatialCleanupRef.current();
      analyserRef.current = null;
      filtersRef.current = [];
      spaceInRef.current = null;
      spaceOutRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    },
    []
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      shouldPlayRef.current = true;
      audioContextRef.current?.resume().catch(() => {});
      audio.play().catch(() => {
        setPlayerError("This track could not be streamed — try the next one.");
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [current]);

  const startQueue = useCallback(
    (list: Song[], label: string, position: number) => {
      const track = list[position];
      if (!track) return;
      // Pressing the tile that is already active toggles playback.
      if (queue[index]?.id === track.id) {
        togglePlay();
        return;
      }
      shouldPlayRef.current = true;
      setQueue(list);
      setQueueLabel(label);
      setIndex(position);
    },
    [queue, index, togglePlay]
  );

  const stepTrack = useCallback(
    (direction: 1 | -1) => {
      if (index < 0) return;
      const audio = audioRef.current;
      // The first "previous" within the opening seconds restarts the track.
      if (direction === -1 && audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }
      const next = index + direction;
      if (next < 0) {
        if (audio) audio.currentTime = 0;
        return;
      }
      // Wrap around the queue so a long listening session never dead-ends.
      shouldPlayRef.current = true;
      setIndex(next >= queue.length ? 0 : next);
    },
    [index, queue]
  );

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setProgress(seconds);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    setMutedState(false);
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
  }, []);

  const applyPreset = useCallback((preset: EqPreset) => {
    setEqPreset(preset.label);
    setEqGains([...preset.gains]);
  }, []);

  const setSpatialMode = useCallback((mode: SpatialMode) => {
    spatialModeRef.current = mode;
    setSpatialModeState(mode);
    applySpatial();
  }, [applySpatial]);

  // OS media controls: lock screen, notification shade and hardware keys keep
  // working with the tab in the background — the music keeps playing there.
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album || undefined,
        artwork: current.imageLarge
          ? [{ src: current.imageLarge, sizes: "500x500", type: "image/jpeg" }]
          : [],
      });
      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("nexttrack", () => stepTrack(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => stepTrack(-1));
    } catch {
      // MediaSession is progressive enhancement only.
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      } catch {
        // ignore
      }
    };
  }, [current, togglePlay, stepTrack]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  }, [playing]);

  const value = useMemo<MusicPlayerValue>(
    () => ({
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
      getAnalyser,
      startQueue,
      togglePlay,
      stepTrack,
      seek,
      setVolume,
      setMuted,
      applyPreset,
      setEqGains,
      spatialMode,
      setSpatialMode,
    }),
    [
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
      getAnalyser,
      startQueue,
      togglePlay,
      stepTrack,
      seek,
      setVolume,
      setMuted,
      applyPreset,
      setEqGains,
      spatialMode,
      setSpatialMode,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {/* The singleton media element — persists through navigation. */}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) =>
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
        }
        onEnded={() => stepTrack(1)}
        onError={() => {
          if (current) {
            setPlayerError("This track could not be streamed — try another one.");
            setPlaying(false);
          }
        }}
      />
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): MusicPlayerValue {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return value;
}
