import { useCallback, useEffect, useRef, useState } from "react";

// ─── TEXT-TO-SPEECH ───
// Card names and meanings are ENGLISH text. We explicitly pick an English
// voice (en-US → en-GB → any en → system default) rather than trusting the
// system default, which on a German machine would read "The Hierophant" in
// a German accent. Falls back gracefully if no English voice is available.
export function useSpeech() {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const voiceRef = useRef(null);
  const [voice, setVoice] = useState(null);
  const [voicesReady, setVoicesReady] = useState(false);

  useEffect(() => {
    if (!synth) return;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      const en = voices.filter((v) => /^en\b|^en[-_]/i.test(v.lang));
      const chosen =
        en.find((v) => /en[-_]us/i.test(v.lang)) ||
        en.find((v) => /en[-_]gb/i.test(v.lang)) ||
        en[0] ||
        null;
      voiceRef.current = chosen;
      setVoice(chosen);
      setVoicesReady(true);
    };
    pick();
    synth.addEventListener?.("voiceschanged", pick);
    return () => synth.removeEventListener?.("voiceschanged", pick);
  }, [synth]);

  // Speak text and resolve when finished (or on error / safety timeout so the
  // drill loop can never deadlock waiting on a speech end event that never fires).
  const speak = useCallback((text, { rate = 1 } = {}) => {
    return new Promise((resolve) => {
      if (!synth || !text) { resolve(); return; }
      try { synth.cancel(); } catch (e) { /* ignore */ }
      const u = new SpeechSynthesisUtterance(text);
      const v = voiceRef.current;
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
      u.rate = rate;

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const estMs = (text.length / 12) * (1000 / Math.max(0.5, rate)) + 2500;
      const timer = setTimeout(finish, estMs + 4000);
      u.onend = finish;
      u.onerror = finish;
      try { synth.speak(u); } catch (e) { finish(); }
    });
  }, [synth]);

  const cancel = useCallback(() => {
    try { synth?.cancel(); } catch (e) { /* ignore */ }
  }, [synth]);

  return {
    speak,
    cancel,
    supported: !!synth,
    voice,
    voicesReady,
    hasEnglishVoice: !!voice,
  };
}
