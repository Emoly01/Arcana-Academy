import { useCallback, useEffect, useRef, useState } from "react";
import { parseUtterance } from "./commands";
import { useSpeech } from "./useSpeech";
import { useSpeechRecognition, getSpeechRecognition } from "./useSpeechRecognition";

const GOLD = "#c9a84c";
const CREAM = "#e8dcc8";
const GREEN = "rgba(76,175,80,";
const RED = "rgba(220,53,69,";

const CONF_META = {
  sicher:   { label: "Sicher",   sub: "confident", color: GREEN },
  wackelig: { label: "Wackelig", sub: "unsure",    color: "rgba(201,168,76," },
  geraten:  { label: "Geraten",  sub: "guessed",   color: RED },
};

function orientationToUpright(orientation) {
  if (orientation === "upright") return true;
  if (orientation === "reversed") return false;
  return Math.random() < 0.5;
}

// ─── VOICE DRILL — ears-first, hands-free active recall ───
// Two flavours, chosen on the start screen:
//   • Self-graded  — hear the card, recall silently, say "aufdecken", grade yourself.
//   • Spoken recall — hear the card, SAY the meanings aloud, "aufdecken"; the app
//     scores your speech against the card's keywords and proposes a grade.
// Either way results flow through the existing SRS, tagged mode:"voice", and the
// queue honours the deck + orientation you pick.
export default function VoiceDrillMode({
  buildQueue, onGrade, onExit, modeStats, scoreAnswer,
  unlockedMinor, defaultDeck = "all", defaultOrientation = "both",
}) {
  const recognitionSupported = !!getSpeechRecognition();
  const { speak, cancel, supported: ttsSupported, hasEnglishVoice, voicesReady } = useSpeech();
  const supported = recognitionSupported && ttsSupported;

  // ── setup choices (start screen) ──
  const [recallMode, setRecallMode] = useState("self"); // self | spoken
  const [deck, setDeck] = useState(defaultDeck);
  const [orientation, setOrientation] = useState(defaultOrientation);

  // ── UI state (mirrors of the imperative refs below) ──
  const [phase, setPhase] = useState("ready");   // ready | running | summary
  const [step, setStep] = useState("asking");     // asking | listen-reveal | listen-answer | revealing | listen-grade
  const [paused, setPaused] = useState(false);
  const [card, setCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [needConfidence, setNeedConfidence] = useState(false);
  const [pendingGrade, setPendingGrade] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [liveMatched, setLiveMatched] = useState([]);
  const [lastHeard, setLastHeard] = useState("");
  const [sessionItems, setSessionItems] = useState([]);

  // ── imperative state (read inside async flows / recognition callback) ──
  const mountedRef = useRef(true);
  const phaseRef = useRef("ready");
  const stepRef = useRef("asking");
  const pausedRef = useRef(false);
  const cardRef = useRef(null);
  const pendingRef = useRef({ grade: null, confidence: null, proposed: false });
  const answerRef = useRef([]);          // accumulated spoken answer (spoken mode)
  const queueRef = useRef([]);
  const idxRef = useRef(0);
  const sessionRef = useRef({ items: [] });
  const recallModeRef = useRef("self");
  const deckRef = useRef(defaultDeck);
  const orientationRef = useRef(defaultOrientation);
  const fns = useRef({});

  const onDenied = useCallback(() => {}, []);
  const handleUtteranceRef = useRef(() => {});
  const stableOnResult = useCallback((t) => handleUtteranceRef.current(t), []);
  const rec = useSpeechRecognition({ lang: "de-DE", onResult: stableOnResult, onPermissionDenied: onDenied });

  // Runs once: tear down mic + TTS on unmount only. rec.stop and cancel are
  // stable callbacks, so capturing them from the first render is safe — and we
  // must NOT depend on `rec` (a fresh object each render) or this would fire
  // every re-render and set mountedRef=false mid-session, killing the loop.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try { rec.stop(); } catch (e) {}
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardActive = () =>
    mountedRef.current && !pausedRef.current && phaseRef.current === "running";

  const meaningsOf = (item) => (item.isUpright ? item.card.upright : item.card.reversed);
  const readoutOf = (item) => `${meaningsOf(item).join(", ")}. ${item.card.keywords}`;

  // Re-assign the flow functions on every render so they always close over the
  // latest props while being invoked through a stable ref.
  fns.current.startListening = () => {
    if (mountedRef.current && !pausedRef.current) rec.start();
  };

  fns.current.speakAndPause = async (text, opts) => {
    rec.stop();               // don't let the app hear itself
    await speak(text, opts);
  };

  fns.current.askCard = async (item) => {
    cardRef.current = item;
    setCard(item);
    setRevealed(false);
    setScoreResult(null);
    setLiveMatched([]);
    answerRef.current = [];
    pendingRef.current = { grade: null, confidence: null, proposed: false };
    setPendingGrade(null);
    setNeedConfidence(false);
    stepRef.current = "asking"; setStep("asking");
    await fns.current.speakAndPause(item.card.name, { rate: 0.95 });
    if (!guardActive()) return;
    const nextStep = recallModeRef.current === "spoken" ? "listen-answer" : "listen-reveal";
    stepRef.current = nextStep; setStep(nextStep);
    fns.current.startListening();
  };

  // Self-graded reveal: read the answer, then listen for a self-grade.
  fns.current.reveal = async () => {
    if (stepRef.current !== "listen-reveal" && stepRef.current !== "asking") return;
    const item = cardRef.current;
    if (!item) return;
    setRevealed(true);
    stepRef.current = "revealing"; setStep("revealing");
    await fns.current.speakAndPause(readoutOf(item), { rate: 0.82 });
    if (!guardActive()) return;
    stepRef.current = "listen-grade"; setStep("listen-grade");
    fns.current.startListening();
  };

  // Spoken-recall finish: score what was said, read the answer, propose a grade.
  fns.current.finishAnswer = async () => {
    const item = cardRef.current;
    if (!item) return;
    const text = answerRef.current.join(" ");
    const result = scoreAnswer(text, item.card, item.isUpright);
    setScoreResult(result);
    const proposed = result.score >= 0.4 ? "correct" : "wrong";
    pendingRef.current = { grade: proposed, confidence: null, proposed: true };
    setPendingGrade(proposed);
    setRevealed(true);
    stepRef.current = "revealing"; setStep("revealing");
    const recalled = `You recalled ${result.matched.length} of ${result.total}.`;
    await fns.current.speakAndPause(`${recalled} ${readoutOf(item)}`, { rate: 0.82 });
    if (!guardActive()) return;
    stepRef.current = "listen-grade"; setStep("listen-grade");
    fns.current.startListening();
  };

  fns.current.repeatCurrent = async () => {
    const item = cardRef.current;
    if (!item) return;
    const s = stepRef.current;
    if (s === "listen-grade" || s === "revealing") {
      stepRef.current = "revealing"; setStep("revealing");
      await fns.current.speakAndPause(readoutOf(item), { rate: 0.82 });
      if (!guardActive()) return;
      stepRef.current = "listen-grade"; setStep("listen-grade");
      fns.current.startListening();
    } else {
      const back = recallModeRef.current === "spoken" ? "listen-answer" : "listen-reveal";
      stepRef.current = "asking"; setStep("asking");
      await fns.current.speakAndPause(item.card.name, { rate: 0.95 });
      if (!guardActive()) return;
      stepRef.current = back; setStep(back);
      fns.current.startListening();
    }
  };

  fns.current.commit = (correct, confidence) => {
    const item = cardRef.current;
    if (!item) return;
    rec.stop();
    onGrade(item.card.id, correct, confidence);
    sessionRef.current.items.push({ name: item.card.name, correct, confidence });
    setSessionItems([...sessionRef.current.items]);
    pendingRef.current = { grade: null, confidence: null, proposed: false };
    setPendingGrade(null);
    setNeedConfidence(false);
    fns.current.next();
  };

  // Self-mode: a wrong answer commits at once; a correct one asks for confidence
  // if none was given in the same breath (calibration matters most there).
  fns.current.maybeCommit = () => {
    const p = pendingRef.current;
    setPendingGrade(p.grade);
    if (!p.grade) return;
    if (p.grade === "correct" && !p.confidence) { setNeedConfidence(true); return; }
    fns.current.commit(p.grade === "correct", p.confidence || null);
  };

  fns.current.next = () => {
    idxRef.current += 1;
    if (idxRef.current >= queueRef.current.length) {
      queueRef.current = buildQueue(deckRef.current, orientationRef.current);
      idxRef.current = 0;
    }
    const nextItem = queueRef.current[idxRef.current];
    if (!nextItem) { fns.current.finish(); return; }
    fns.current.askCard(nextItem);
  };

  fns.current.appendAnswer = (transcript) => {
    answerRef.current = [...answerRef.current, transcript];
    const item = cardRef.current;
    if (!item) return;
    const result = scoreAnswer(answerRef.current.join(" "), item.card, item.isUpright);
    setLiveMatched(result.matched.map((m) => m.meaning));
  };

  fns.current.doPause = () => {
    pausedRef.current = true; setPaused(true);
    rec.stop();
    cancel();
  };

  fns.current.doResume = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false; setPaused(false);
    fns.current.repeatCurrent();
  };

  fns.current.finish = () => {
    phaseRef.current = "summary"; setPhase("summary");
    rec.stop();
    cancel();
  };

  // ── the recognition callback (kept fresh via ref) ──
  handleUtteranceRef.current = (transcript) => {
    if (!transcript) return;
    setLastHeard(transcript);
    const p = parseUtterance(transcript);

    // Global controls first.
    if (p.stop) { fns.current.finish(); return; }
    if (p.pause) { fns.current.doPause(); return; }
    if (pausedRef.current) { if (p.resume) fns.current.doResume(); return; }

    const s = stepRef.current;

    if (s === "listen-answer") {
      if (p.reveal) { fns.current.finishAnswer(); return; }
      if (p.repeat) { fns.current.repeatCurrent(); return; }
      // Everything else is the spoken answer itself.
      fns.current.appendAnswer(transcript);
      return;
    }

    if (p.repeat) { fns.current.repeatCurrent(); return; }

    if (s === "listen-reveal") {
      if (p.reveal) fns.current.reveal();
      return;
    }

    if (s === "listen-grade") {
      if (recallModeRef.current === "spoken") {
        // Proposed grade already set; accept with "weiter", or override by voice.
        if (p.confidence) pendingRef.current.confidence = p.confidence;
        if (p.grade) {
          pendingRef.current.grade = p.grade; pendingRef.current.proposed = false;
          fns.current.commit(p.grade === "correct", pendingRef.current.confidence || null);
          return;
        }
        if (p.resume || p.reveal) {
          fns.current.commit(pendingRef.current.grade === "correct", pendingRef.current.confidence || null);
        }
        return;
      }
      if (p.grade) pendingRef.current.grade = p.grade;
      if (p.confidence) pendingRef.current.confidence = p.confidence;
      if (p.grade || p.confidence) fns.current.maybeCommit();
    }
  };

  // ── tap-target handlers: identical effect to the spoken commands ──
  const beginSession = () => {
    recallModeRef.current = recallMode;
    deckRef.current = deck;
    orientationRef.current = orientation;
    const q = buildQueue(deck, orientation);
    queueRef.current = q; idxRef.current = 0;
    sessionRef.current = { items: [] };
    setSessionItems([]);
    phaseRef.current = "running"; setPhase("running");
    if (!q.length) { fns.current.finish(); return; }
    fns.current.askCard(q[0]);
  };
  const tapReveal = () => {
    if (stepRef.current === "listen-answer") fns.current.finishAnswer();
    else fns.current.reveal();
  };
  const tapGrade = (g) => {
    if (stepRef.current !== "listen-grade" && stepRef.current !== "revealing") return;
    if (recallModeRef.current === "spoken") {
      pendingRef.current.grade = g; pendingRef.current.proposed = false;
      fns.current.commit(g === "correct", pendingRef.current.confidence || null);
    } else {
      pendingRef.current.grade = g;
      fns.current.maybeCommit();
    }
  };
  const tapAcceptNext = () => {
    const p = pendingRef.current;
    fns.current.commit(p.grade === "correct", p.confidence || null);
  };
  const tapConfidence = (c) => {
    pendingRef.current.confidence = c;
    fns.current.maybeCommit();
  };
  const tapRepeat = () => fns.current.repeatCurrent();
  const tapPauseResume = () => (pausedRef.current ? fns.current.doResume() : fns.current.doPause());
  const tapStop = () => fns.current.finish();

  // ─────────────────────────────── RENDER ───────────────────────────────
  const title = (
    <>
      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }}
          onClick={() => { fns.current.finish(); onExit(); }}>← Back</button>
        <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 500, letterSpacing: 2, color: GOLD }}>
          🎙 Voice Drill · Sprachmodus
        </h2>
      </div>
    </>
  );

  if (!supported) {
    return (
      <div>
        {title}
        <div style={{ padding: 20, background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🦉</div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, color: CREAM, marginBottom: 8 }}>Voice Drill needs Chrome</div>
          <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(201,168,76,0.6)", lineHeight: 1.6, fontWeight: 300 }}>
            This ears-first mode relies on the Web Speech API, which today only works reliably in
            Chromium-based browsers (Chrome, Edge, Brave). Open Arcana Academy there to study hands-free.
            {" "}Every other mode works everywhere.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {title}

      {phase === "ready" && (
        <ReadyView
          recallMode={recallMode} setRecallMode={setRecallMode}
          deck={deck} setDeck={setDeck}
          orientation={orientation} setOrientation={setOrientation}
          unlockedMinor={unlockedMinor}
          voicesReady={voicesReady} hasEnglishVoice={hasEnglishVoice}
          onBegin={beginSession}
        />
      )}

      {phase === "running" && (
        <RunningView
          card={card} step={step} paused={paused} revealed={revealed}
          recallMode={recallModeRef.current}
          listening={rec.listening} micError={rec.error} lastHeard={lastHeard}
          needConfidence={needConfidence} pendingGrade={pendingGrade}
          scoreResult={scoreResult} liveMatched={liveMatched}
          reviewed={sessionItems.length}
          onReveal={tapReveal} onGrade={tapGrade} onConfidence={tapConfidence}
          onAcceptNext={tapAcceptNext}
          onRepeat={tapRepeat} onPauseResume={tapPauseResume} onStop={tapStop}
          onRetryMic={() => rec.start()}
        />
      )}

      {phase === "summary" && (
        <SummaryView items={sessionItems} modeStats={modeStats}
          onAgain={beginSession} onHome={onExit} />
      )}
    </div>
  );
}

// ── Sub-views ──────────────────────────────────────────────────────────

function ReadyView({
  recallMode, setRecallMode, deck, setDeck, orientation, setOrientation,
  unlockedMinor, voicesReady, hasEnglishVoice, onBegin,
}) {
  const deckOptions = [
    { key: "all", label: unlockedMinor ? "All 78" : "All" },
    { key: "major", label: "Major Arcana" },
    ...(unlockedMinor ? [
      { key: "minor", label: "All Minor" },
      { key: "wands", label: "🔥 Wands" },
      { key: "cups", label: "💧 Cups" },
      { key: "swords", label: "🌬 Swords" },
      { key: "pentacles", label: "🪙 Pentacles" },
    ] : []),
  ];
  const modes = [
    { key: "self", icon: "✔", title: "Self-graded", desc: "Recall silently, then grade yourself out loud." },
    { key: "spoken", icon: "🗣", title: "Spoken recall", desc: "Say the meanings aloud — the app scores what you said." },
  ];
  return (
    <div>
      <div style={{ padding: "20px", background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: CREAM, lineHeight: 1.7, fontWeight: 300 }}>
          A hands-free recall loop. I speak a card, you recall its meaning, then say
          <b style={{ color: GOLD }}> "aufdecken"</b> to hear the answer. Grade by voice — you'll
          never need the screen. Best studied while your hands are busy.
        </div>
      </div>

      {/* Recall mode */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.35)", letterSpacing: 1, marginBottom: 8 }}>RECALL STYLE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modes.map((m) => {
            const active = recallMode === m.key;
            return (
              <div key={m.key} onClick={() => setRecallMode(m.key)} style={{
                padding: "12px 16px", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                background: active ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.03)",
                border: `1px solid ${active ? "rgba(201,168,76,0.45)" : "rgba(201,168,76,0.1)"}`,
                transition: "all 0.2s ease",
              }}>
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: active ? "#e8dcc8" : "rgba(232,220,200,0.7)", fontWeight: 500 }}>{m.title}</div>
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11.5, color: "rgba(201,168,76,0.5)", fontWeight: 300 }}>{m.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deck */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.35)", letterSpacing: 1, marginBottom: 8 }}>CARD POOL</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {deckOptions.map((f) => (
            <button key={f.key} className={`filter-btn ${deck === f.key ? "active" : ""}`} onClick={() => setDeck(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Orientation */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.35)", letterSpacing: 1, marginBottom: 8 }}>ORIENTATION</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ key: "both", label: "Both" }, { key: "upright", label: "↑ Upright" }, { key: "reversed", label: "↓ Reversed" }].map((f) => (
            <button key={f.key} className={`filter-btn ${orientation === f.key ? "active" : ""}`} onClick={() => setOrientation(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>

      <CommandCheatSheet spoken={recallMode === "spoken"} />

      {voicesReady && !hasEnglishVoice && (
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(220,53,69,0.7)", margin: "12px 2px", fontWeight: 300 }}>
          ⚠ No English voice found on this device — falling back to the system default. Card names may sound off.
        </div>
      )}
      <button className="nav-btn nav-btn-primary" style={{ width: "100%", padding: "16px", fontSize: 15, marginTop: 14 }} onClick={onBegin}>
        ✦ Begin Drill ✦
      </button>
      <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", textAlign: "center", marginTop: 10, fontWeight: 300 }}>
        Your browser will ask for microphone access.
      </div>
    </div>
  );
}

function CommandCheatSheet({ spoken }) {
  const rows = [
    ["aufdecken / reveal", spoken ? "score my answer" : "hear the answer"],
    ["hatte ich / correct", spoken ? "override → right" : "you got it right"],
    ["daneben / wrong", spoken ? "override → wrong" : "you missed it"],
    ...(spoken ? [["weiter / continue", "accept & next card"]] : [["sicher · wackelig · geraten", "how confident you were"]]),
    ["wiederholen / repeat", "hear it again"],
    ["pause · weiter", "pause / resume listening"],
    ["stopp / fertig", "end the session"],
  ];
  return (
    <div style={{ padding: "16px 18px", background: "rgba(201,168,76,0.03)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 14 }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 1, color: "rgba(201,168,76,0.7)", marginBottom: 10 }}>VOICE COMMANDS</div>
      {rows.map(([cmd, desc]) => (
        <div key={cmd} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontFamily: "'Raleway', sans-serif", fontSize: 12.5 }}>
          <span style={{ color: GOLD, fontWeight: 400 }}>{cmd}</span>
          <span style={{ color: "rgba(201,168,76,0.45)", fontWeight: 300, textAlign: "right" }}>{desc}</span>
        </div>
      ))}
      {spoken && (
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", marginTop: 8, fontWeight: 300, lineHeight: 1.5 }}>
          Just say the meanings out loud after the card name, then “aufdecken”.
        </div>
      )}
    </div>
  );
}

function StatusPill({ paused, listening, step }) {
  let label, color, dot;
  const speaking = step === "asking" || step === "revealing";
  if (paused) { label = "Paused"; color = "rgba(201,168,76,0.6)"; dot = "rgba(201,168,76,0.5)"; }
  else if (speaking) { label = "Speaking…"; color = GOLD; dot = GOLD; }
  else if (listening) { label = step === "listen-answer" ? "Listening — say the meanings…" : "Listening…"; color = "rgba(76,175,80,0.9)"; dot = "rgba(76,175,80,0.9)"; }
  else { label = "…"; color = "rgba(201,168,76,0.5)"; dot = "rgba(201,168,76,0.4)"; }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%", background: dot,
        animation: (listening && !paused && !speaking) ? "pulse 1.4s ease-in-out infinite" : (speaking ? "breathe 1.2s ease-in-out infinite" : "none"),
        boxShadow: `0 0 10px ${dot}`,
      }} />
      <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, letterSpacing: 1, color, fontWeight: 400 }}>{label}</span>
    </div>
  );
}

function BigTap({ label, sub, onClick, tone = "gold", disabled }) {
  const tones = {
    gold: { bg: "rgba(201,168,76,0.1)", border: "rgba(201,168,76,0.4)", color: CREAM },
    green: { bg: `${GREEN}0.12)`, border: `${GREEN}0.5)`, color: "#d4f5d6" },
    red: { bg: `${RED}0.12)`, border: `${RED}0.5)`, color: "#f5d0d4" },
  };
  const t = tones[tone];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, minWidth: 0, padding: "16px 10px", borderRadius: 14, cursor: disabled ? "default" : "pointer",
      background: disabled ? "rgba(201,168,76,0.03)" : t.bg,
      border: `1px solid ${disabled ? "rgba(201,168,76,0.1)" : t.border}`,
      color: disabled ? "rgba(201,168,76,0.25)" : t.color,
      fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 500, transition: "all 0.2s ease",
    }}>
      {label}
      {sub && <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, fontWeight: 300, opacity: 0.7, marginTop: 3, textTransform: "none", letterSpacing: 0 }}>{sub}</div>}
    </button>
  );
}

function RunningView({
  card, step, paused, revealed, recallMode, listening, micError, lastHeard,
  needConfidence, pendingGrade, scoreResult, liveMatched, reviewed,
  onReveal, onGrade, onConfidence, onAcceptNext, onRepeat, onPauseResume, onStop, onRetryMic,
}) {
  const meanings = card ? (card.isUpright ? card.card.upright : card.card.reversed) : [];
  const spoken = recallMode === "spoken";
  const inGrade = step === "listen-grade" || step === "revealing";
  return (
    <div>
      {micError === "mic-denied" && (
        <div style={{ padding: 16, background: `${RED}0.08)`, border: `1px solid ${RED}0.3)`, borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(220,53,69,0.9)", lineHeight: 1.6 }}>
            🎤 Microphone access is blocked. Enable it in your browser's site settings, then tap below.
            You can still grade with the buttons in the meantime.
          </div>
          <button className="nav-btn nav-btn-ghost" style={{ marginTop: 10, padding: "6px 14px", fontSize: 11 }} onClick={onRetryMic}>Retry microphone</button>
        </div>
      )}

      <div style={{ textAlign: "center", padding: "18px 0 10px" }}>
        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, letterSpacing: 2, color: "rgba(201,168,76,0.4)", marginBottom: 10 }}>
          {reviewed} REVIEWED {card && card.isUpright === false ? "· REVERSED" : ""}
        </div>
        <div style={{
          fontFamily: "'Cinzel', serif", fontWeight: 600, letterSpacing: 1, lineHeight: 1.15,
          fontSize: card && card.card.name.length > 16 ? 30 : 38,
          background: "linear-gradient(135deg, #c9a84c, #e8dcc8, #c9a84c)", backgroundSize: "200%",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          minHeight: 50, padding: "0 8px",
        }}>
          {card ? card.card.name : "…"}
        </div>
        <div style={{ marginTop: 12 }}>
          <StatusPill paused={paused} listening={listening} step={step} />
        </div>
      </div>

      {/* Spoken-mode: live matched keywords while you talk */}
      {spoken && step === "listen-answer" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", minHeight: 30 }}>
            {meanings.map((m) => {
              const hit = liveMatched.includes(m);
              return (
                <span key={m} style={{
                  padding: "5px 11px", borderRadius: 16, fontFamily: "'Raleway', sans-serif", fontSize: 12,
                  background: hit ? `${GREEN}0.15)` : "rgba(201,168,76,0.05)",
                  border: `1px solid ${hit ? `${GREEN}0.5)` : "rgba(201,168,76,0.12)"}`,
                  color: hit ? "#d4f5d6" : "rgba(201,168,76,0.35)",
                  transition: "all 0.2s ease",
                }}>{hit ? `✓ ${m}` : "•••"}</span>
              );
            })}
          </div>
          <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", textAlign: "center", marginTop: 8, fontWeight: 300 }}>
            {liveMatched.length} of {meanings.length} recalled — say “aufdecken” when done
          </div>
        </div>
      )}

      {/* Revealed meaning (shown visually too) */}
      <div style={{
        minHeight: 60, padding: revealed ? "14px 18px" : 0, margin: "6px 0 16px",
        background: revealed ? "rgba(201,168,76,0.05)" : "transparent",
        border: revealed ? "1px solid rgba(201,168,76,0.15)" : "1px solid transparent",
        borderRadius: 14, transition: "all 0.3s ease", textAlign: "center",
      }}>
        {revealed ? (
          <>
            {spoken && scoreResult && (
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 1, color: pendingGrade === "correct" ? "rgba(76,175,80,0.9)" : "rgba(220,53,69,0.85)", marginBottom: 10 }}>
                YOU RECALLED {scoreResult.matched.length} / {scoreResult.total}
              </div>
            )}
            <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 17, color: CREAM, lineHeight: 1.6 }}>
              {spoken && scoreResult
                ? meanings.map((m) => {
                    const hit = scoreResult.matched.some((x) => x.meaning === m);
                    return <span key={m} style={{ color: hit ? "#d4f5d6" : "rgba(232,220,200,0.55)", textDecoration: hit ? "none" : "none" }}>{hit ? "✓ " : "✗ "}{m}<span style={{ color: "rgba(201,168,76,0.3)" }}> · </span></span>;
                  })
                : meanings.join(" · ")}
            </div>
            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.55)", marginTop: 8, fontStyle: "italic", fontWeight: 300 }}>
              {card.card.keywords}
            </div>
          </>
        ) : (
          !(spoken && step === "listen-answer") && (
            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(201,168,76,0.35)", textAlign: "center", paddingTop: 18, fontWeight: 300 }}>
              Recall the meaning, then say “aufdecken”
            </div>
          )
        )}
      </div>

      {/* Tap targets mirror every voice command */}
      {!paused && (step === "listen-reveal" || (spoken && step === "listen-answer")) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <BigTap label="Aufdecken" sub={spoken ? "score my answer" : "reveal"} tone="gold" onClick={onReveal} />
        </div>
      )}

      {!paused && inGrade && !spoken && (
        !needConfidence ? (
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <BigTap label="Hatte ich" sub="correct" tone="green" onClick={() => onGrade("correct")} />
            <BigTap label="Daneben" sub="wrong" tone="red" onClick={() => onGrade("wrong")} />
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: GOLD, textAlign: "center", marginBottom: 8, letterSpacing: 1 }}>
              How confident? — sicher · wackelig · geraten
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(CONF_META).map(([key, m]) => (
                <BigTap key={key} label={m.label} sub={m.sub} tone={key === "sicher" ? "green" : key === "geraten" ? "red" : "gold"} onClick={() => onConfidence(key)} />
              ))}
            </div>
          </div>
        )
      )}

      {!paused && inGrade && spoken && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <BigTap label="Hatte ich" sub="override → right" tone="green" onClick={() => onGrade("correct")} />
            <BigTap label="Daneben" sub="override → wrong" tone="red" onClick={() => onGrade("wrong")} />
          </div>
          <button className="nav-btn nav-btn-primary" style={{ width: "100%" }} onClick={onAcceptNext}>
            Weiter — accept & next →
          </button>
        </div>
      )}

      {/* Always-available controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button className="nav-btn nav-btn-ghost" style={{ flex: 1, padding: "10px", fontSize: 11 }} onClick={onRepeat}>↻ Wiederholen</button>
        <button className="nav-btn nav-btn-ghost" style={{ flex: 1, padding: "10px", fontSize: 11 }} onClick={onPauseResume}>{paused ? "▶ Weiter" : "❚❚ Pause"}</button>
        <button className="nav-btn nav-btn-ghost" style={{ flex: 1, padding: "10px", fontSize: 11, borderColor: `${RED}0.25)`, color: "rgba(220,53,69,0.7)" }} onClick={onStop}>■ Stopp</button>
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.35)", fontWeight: 300, minHeight: 16 }}>
        {lastHeard ? <>heard: “<span style={{ color: "rgba(201,168,76,0.6)" }}>{lastHeard}</span>”</> : " "}
      </div>
    </div>
  );
}

function SummaryView({ items, modeStats, onAgain, onHome }) {
  const reviewed = items.length;
  const correct = items.filter((i) => i.correct).length;
  const acc = reviewed ? Math.round((correct / reviewed) * 100) : 0;
  const buckets = ["sicher", "wackelig", "geraten"].map((c) => {
    const g = items.filter((i) => i.confidence === c);
    return { c, total: g.length, correct: g.filter((x) => x.correct).length };
  });
  const hasConfidence = buckets.some((b) => b.total > 0);
  const unspecified = items.filter((i) => !i.confidence).length;

  const voiceLifetime = modeStats?.voice;
  const quizLifetime = modeStats?.quiz;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>✦</div>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, letterSpacing: 2, color: GOLD }}>Session Complete</div>
      </div>

      {reviewed === 0 ? (
        <div style={{ textAlign: "center", fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(201,168,76,0.6)", marginBottom: 20, fontWeight: 300 }}>
          No cards graded this session.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <StatTile big={reviewed} label="Cards reviewed" />
            <StatTile big={`${acc}%`} label="Accuracy" />
            <StatTile big={`${correct}/${reviewed}`} label="Correct" />
          </div>

          {hasConfidence && (
            <div style={{ padding: "16px 18px", background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 1, color: "rgba(201,168,76,0.7)", marginBottom: 12 }}>CALIBRATION — this session</div>
              {buckets.map(({ c, total, correct: cc }) => {
                const m = CONF_META[c];
                const pct = total ? Math.round((cc / total) * 100) : 0;
                return (
                  <div key={c} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Raleway', sans-serif", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: CREAM }}>{m.label} <span style={{ color: "rgba(201,168,76,0.4)" }}>· {m.sub}</span></span>
                      <span style={{ color: "rgba(201,168,76,0.6)" }}>{total ? `${cc}/${total} · ${pct}%` : "—"}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(201,168,76,0.08)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: `${m.color}0.6)`, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                );
              })}
              {unspecified > 0 && (
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.35)", marginTop: 6, fontWeight: 300 }}>
                  {unspecified} graded without a stated confidence
                </div>
              )}
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", marginTop: 10, lineHeight: 1.5, fontWeight: 300 }}>
                High accuracy on “geraten” means you know more than you think. Low accuracy on “sicher” flags overconfidence.
              </div>
            </div>
          )}

          {(voiceLifetime || quizLifetime) && (
            <div style={{ padding: "14px 18px", background: "rgba(201,168,76,0.03)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 1, color: "rgba(201,168,76,0.7)", marginBottom: 10 }}>MODE COMPARISON — all time</div>
              <ModeRow name="🎙 Voice" stats={voiceLifetime} />
              <ModeRow name="🃏 Quiz" stats={quizLifetime} />
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="nav-btn nav-btn-primary" style={{ flex: 1 }} onClick={onAgain}>Drill Again</button>
        <button className="nav-btn nav-btn-ghost" style={{ flex: 1 }} onClick={onHome}>← Home</button>
      </div>
    </div>
  );
}

function StatTile({ big, label }) {
  return (
    <div style={{ flex: 1, padding: "14px 8px", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 12, textAlign: "center" }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: GOLD, fontWeight: 600 }}>{big}</div>
      <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, color: "rgba(201,168,76,0.5)", letterSpacing: 0.5, marginTop: 4, fontWeight: 300 }}>{label}</div>
    </div>
  );
}

function ModeRow({ name, stats }) {
  const reviewed = stats?.reviewed || 0;
  const correct = stats?.correct || 0;
  const pct = reviewed ? Math.round((correct / reviewed) * 100) : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Raleway', sans-serif", fontSize: 12.5, padding: "4px 0", color: CREAM }}>
      <span>{name}</span>
      <span style={{ color: "rgba(201,168,76,0.6)" }}>
        {reviewed ? `${reviewed} reviewed · ${pct}% correct` : "no data yet"}
      </span>
    </div>
  );
}
