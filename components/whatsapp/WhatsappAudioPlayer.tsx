"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { fetchMediaContentBlob } from "@/lib/api/whatsapp";

type Props = {
  mediaUrl?: string | null;
  mediaId?: string | null;
  /** outbound = bulle primaire */
  variant?: "inbound" | "outbound";
};

const WAVE_BARS = [3, 5, 8, 4, 9, 6, 10, 5, 8, 7, 4, 9, 6, 11, 5, 8, 4, 7, 10, 6, 3, 8, 5, 9, 4, 7, 6, 10, 5, 8];

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WhatsappAudioPlayer({ mediaUrl, mediaId, variant = "inbound" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [src, setSrc] = useState<string | null>(() => mediaUrl?.trim() || null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const reactId = useId();

  useEffect(() => {
    const direct = mediaUrl?.trim() || null;
    if (direct) {
      setSrc(direct);
      setError(false);
      return;
    }

    if (!mediaId) {
      setSrc(null);
      setError(true);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null);
    setError(false);
    void fetchMediaContentBlob(mediaId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaUrl, mediaId]);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  // Progression fluide via rAF pendant la lecture
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const tick = () => {
      const el = audioRef.current;
      if (el) setCurrent(el.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playing]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setError(true));
    } else {
      el.pause();
    }
  }, []);

  const seek = useCallback((ratio: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * el.duration;
    el.currentTime = next;
    setCurrent(next);
  }, []);

  const onWaveClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seek((e.clientX - rect.left) / rect.width);
  };

  if (error && !src) {
    return <span className="small text-danger">Audio indisponible</span>;
  }
  if (!src) {
    return <span className="spinner-border spinner-border-sm text-muted" role="status" />;
  }

  const progress = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  const timeLabel = playing || current > 0 ? formatTime(current) : formatTime(duration);

  const bars = WAVE_BARS.map((h, i) => (
    <span key={`${reactId}-${i}`} className="wa-voice-bar" style={{ height: `${h + 4}px` }} />
  ));

  return (
    <div className={`wa-voice ${variant === "outbound" ? "wa-voice--out" : "wa-voice--in"}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onLoadedMetadata={() => {
          const el = audioRef.current;
          if (el && Number.isFinite(el.duration)) setDuration(el.duration);
        }}
        onDurationChange={() => {
          const el = audioRef.current;
          if (el && Number.isFinite(el.duration)) setDuration(el.duration);
        }}
      />

      <button
        type="button"
        className="wa-voice-play"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Lecture"}
      >
        <i className={playing ? "fi fi-rr-pause" : "fi fi-rr-play"} />
      </button>

      <div className="wa-voice-body">
        <div
          className={`wa-voice-wave${playing ? " is-playing" : ""}`}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-label="Position audio"
          tabIndex={0}
          onClick={onWaveClick}
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "ArrowRight") seek(progress + 0.05);
            if (e.key === "ArrowLeft") seek(progress - 0.05);
          }}
        >
          <div className="wa-voice-wave-track">{bars}</div>
          <div
            className="wa-voice-wave-fill"
            style={{ width: `${progress * 100}%` }}
            aria-hidden
          >
            {bars}
          </div>
        </div>
        <div className="wa-voice-meta">
          <span className="wa-voice-time">{timeLabel}</span>
        </div>
      </div>

      <div className="wa-voice-mic" aria-hidden>
        <i className="fi fi-rr-microphone" />
      </div>
    </div>
  );
}
