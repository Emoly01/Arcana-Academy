import { useCallback, useEffect, useRef, useState } from "react";

// This mode is Chromium-only. Feature-detect webkitSpeechRecognition.
export function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// ─── SPEECH RECOGNITION ───
// Continuous recognition in Chrome dies after a stretch of silence. We handle
// the `end` event and transparently restart, with a guard against a tight
// restart loop (if `end` fires repeatedly within a short window we back off).
// `start`/`stop` set an intent flag so the auto-restart only happens while the
// caller actually wants to be listening — this is how we pause the mic while
// TTS is speaking (stop before speaking, start after).
export function useSpeechRecognition({ lang = "de-DE", onResult, onPermissionDenied } = {}) {
  const SR = getSpeechRecognition();
  const supported = !!SR;

  const recogRef = useRef(null);
  const desiredRef = useRef(false);     // does the caller want to be listening?
  const restartStamps = useRef([]);     // timestamps of recent auto-restarts
  const restartTimer = useRef(null);
  const onResultRef = useRef(onResult);
  const onDeniedRef = useRef(onPermissionDenied);
  onResultRef.current = onResult;
  onDeniedRef.current = onPermissionDenied;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!SR) return;
    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res.isFinal) continue;
        const alts = [];
        for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
        onResultRef.current?.(res[0].transcript, alts);
      }
    };

    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        desiredRef.current = false;
        setListening(false);
        setError("mic-denied");
        onDeniedRef.current?.();
      }
      // no-speech / aborted / network are transient — `onend` handles restart.
    };

    r.onend = () => {
      setListening(false);
      if (!desiredRef.current) return;
      const now = Date.now();
      restartStamps.current = restartStamps.current.filter((t) => now - t < 4000);
      restartStamps.current.push(now);
      if (restartStamps.current.length > 6) {
        // Restarting far too fast — something is wrong. Stop to avoid a hot loop.
        desiredRef.current = false;
        setError("restart-loop");
        return;
      }
      restartTimer.current = setTimeout(() => {
        if (!desiredRef.current || !recogRef.current) return;
        try { recogRef.current.start(); setListening(true); } catch (err) { /* already running */ }
      }, 250);
    };

    recogRef.current = r;
    return () => {
      desiredRef.current = false;
      clearTimeout(restartTimer.current);
      try {
        r.onend = null; r.onresult = null; r.onerror = null;
        r.stop();
      } catch (e) { /* ignore */ }
      recogRef.current = null;
    };
  }, [SR, lang]);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    desiredRef.current = true;
    setError((e) => (e === "restart-loop" ? null : e));
    try { recogRef.current.start(); setListening(true); }
    catch (e) { /* InvalidStateError when already started — fine */ }
  }, []);

  const stop = useCallback(() => {
    desiredRef.current = false;
    clearTimeout(restartTimer.current);
    if (!recogRef.current) return;
    try { recogRef.current.stop(); } catch (e) { /* ignore */ }
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
