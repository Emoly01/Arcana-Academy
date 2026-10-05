import { useCallback, useEffect, useRef, useState } from "react";

// ─── TEXT-TO-SPEECH ───
// We explicitly pick a voice for the content's language rather than trusting
// the system default: tarot names and meanings are ENGLISH, so on a German
// machine the default would read "The Hierophant" in a German accent; German
// study decks need the opposite. Preference for "en": en-US → en-GB → any en;
// for "de": de-DE → any de. Falls back to the system default if none exists.
const REGION_PREFERENCE = { en: ["en-us", "en-gb"], de: ["de-de", "de-at", "de-ch"] };

export function useSpeech(lang = "en") {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const voiceRef = useRef(null);
  const [voice, setVoice] = useState(null);
  const [voicesReady, setVoicesReady] = useState(false);
  const base = String(lang || "en").toLowerCase().split(/[-_]/)[0];

  useEffect(() => {
    if (!synth) return;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      const norm = (v) => String(v.lang || "").toLowerCase().replace("_", "-");
      const matching = voices.filter((v) => norm(v) === base || norm(v).startsWith(`${base}-`));
      let chosen = null;
      for (const region of REGION_PREFERENCE[base] || []) {
        chosen = matching.find((v) => norm(v) === region);
        if (chosen) break;
      }
      chosen = chosen || matching[0] || null;
      voiceRef.current = chosen;
      setVoice(chosen);
      setVoicesReady(true);
    };
    pick();
    synth.addEventListener?.("voiceschanged", pick);
    return () => synth.removeEventListener?.("voiceschanged", pick);
  }, [synth, base]);

  // Speak text and resolve when finished (or on error / safety timeout so the
  // drill loop can never deadlock waiting on a speech end event that never fires).
  const speak = useCallback((text, { rate = 1 } = {}) => {
    return new Promise((resolve) => {
      if (!synth || !text) { resolve(); return; }
      try { synth.cancel(); } catch (e) { /* ignore */ }
      const u = new SpeechSynthesisUtterance(text);
      const v = voiceRef.current;
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = base === "de" ? "de-DE" : "en-US"; }
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
  }, [synth, base]);

  const cancel = useCallback(() => {
    try { synth?.cancel(); } catch (e) { /* ignore */ }
  }, [synth]);

  return {
    speak,
    cancel,
    supported: !!synth,
    voice,
    voicesReady,
    hasVoice: !!voice,
    hasEnglishVoice: !!voice, // kept for existing callers; true when a voice for `lang` exists
  };
}
