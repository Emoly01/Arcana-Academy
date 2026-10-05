// ─── STUDY-DECK REVIEW SESSION ───
// Same grading contract as the tarot quiz: a wrong answer is booked at once;
// a right one is booked when you move on — as "knew it", or as "lucky" if you
// tapped "I guessed" first. Flip cards grade themselves with three buttons.
// Every grade writes only `srs.<cardId>` on this deck's doc.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, S, FONT_SERIF, FONT_SANS } from "../ui/theme";
import { GoldButton, GiltPanel } from "../ui/primitives";
import { getInitialSRS, updateSRS } from "../engine/srs";
import { deckCards } from "./model";
import { buildSessionQueue, generateBasicQuestion, requeueMissed } from "./questions";
import { writeCardSrs, recordDeckSession } from "./store";

export function StudyText({ text, lang, style, as: Tag = "div" }) {
  return <Tag className="study-text" lang={lang} style={{ whiteSpace: "pre-wrap", ...style }}>{text}</Tag>;
}

// Short prompts get the engraved serif; long ones drop to a readable sans.
function promptStyle(text) {
  const n = String(text || "").length;
  if (n <= 40) return { fontFamily: FONT_SERIF, fontSize: 27, lineHeight: 1.2, color: C.goldPale };
  if (n <= 120) return { fontFamily: FONT_SERIF, fontSize: 22, lineHeight: 1.3, color: C.goldPale };
  return { fontFamily: FONT_SANS, fontSize: 16, lineHeight: 1.55, color: C.text };
}

export default function BasicReview({ db, uid, deck, practiceAll = false, onExit }) {
  const lang = deck.language || "de";
  const cards = useMemo(() => deckCards(deck), [deck.id]); // snapshot at session start
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const srsRef = useRef({ ...(deck.srs || {}) });
  const [queue, setQueue] = useState(() => {
    const q = buildSessionQueue(cards, deck.srs || {}, { practiceAll });
    return q.length ? q : buildSessionQueue(cards, deck.srs || {}, { practiceAll: true });
  });
  const [pos, setPos] = useState(0);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [guessed, setGuessed] = useState(false);
  const [results, setResults] = useState([]); // { cardId, correct, confidence }
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [saveError, setSaveError] = useState(null);
  const [finished, setFinished] = useState(false);
  const bookedRef = useRef(false);
  const actionsRef = useRef(null);
  const shownAt = useRef(0);

  const currentId = queue[pos];
  const card = currentId ? byId.get(currentId) : null;

  useEffect(() => {
    if (!card) { setQuestion(null); return; }
    setQuestion(generateBasicQuestion(card, cards, "mixed", { reverse: !!deck.reverse }));
    setSelected(null); setRevealed(false); setGuessed(false);
    window.scrollTo?.(0, 0);
  }, [pos, currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const grade = useCallback((cardId, correct, confidence) => {
    const next = updateSRS(srsRef.current[cardId] || getInitialSRS(), correct, confidence);
    srsRef.current = { ...srsRef.current, [cardId]: next };
    writeCardSrs(db, uid, deck.id, cardId, next).catch((err) => {
      console.error("Review save error:", err);
      setSaveError("Couldn't save the last answer — check your connection.");
    });
    setResults((r) => [...r, { cardId, correct, confidence }]);
    if (correct) {
      setStreak((s) => { const ns = s + 1; setBestStreak((b) => Math.max(b, ns)); return ns; });
    } else {
      setStreak(0);
    }
  }, [db, uid, deck.id]);

  // Book the sitting once, whether it ended normally or by leaving the screen.
  const bookSession = useCallback(() => {
    if (bookedRef.current || results.length === 0) return;
    bookedRef.current = true;
    recordDeckSession(db, uid, deck.id, { bestStreak, previousBest: deck.stats?.bestStreak || 0 })
      .catch((err) => console.error("Session save error:", err));
  }, [db, uid, deck.id, deck.stats, bestStreak, results.length]);
  const bookRef = useRef(bookSession);
  bookRef.current = bookSession;
  useEffect(() => () => bookRef.current(), []);

  const advance = useCallback(() => {
    if (question?.type === "mc" && selected?.correct) {
      grade(card.id, true, guessed ? "lucky" : "knew");
    }
    if (pos + 1 >= queue.length) { setFinished(true); return; }
    setPos((p) => p + 1);
  }, [question, selected, guessed, card, grade, pos, queue.length]);

  const answerMc = useCallback((option) => {
    if (selected) return;
    setSelected(option);
    setRevealed(true);
    shownAt.current = Date.now();
    if (!option.correct) {
      grade(card.id, false, "wrong");
      setQueue((q) => requeueMissed(q, pos, card.id));
    }
  }, [selected, grade, card, pos]);

  const gradeFlip = useCallback((outcome) => {
    let nextQueue = queue;
    if (outcome === "wrong") {
      grade(card.id, false, "wrong");
      nextQueue = requeueMissed(queue, pos, card.id);
      setQueue(nextQueue);
    } else {
      grade(card.id, true, outcome === "lucky" ? "lucky" : "knew");
    }
    if (pos + 1 >= nextQueue.length) setFinished(true); else setPos(pos + 1);
  }, [grade, card, pos, queue]);

  const endNow = useCallback(() => {
    if (question?.type === "mc" && selected?.correct) grade(card.id, true, guessed ? "lucky" : "knew");
    setFinished(true);
  }, [question, selected, guessed, card, grade]);

  useEffect(() => { if (finished) bookSession(); }, [finished, bookSession]);

  // On a phone the answer panel pushes the buttons below the fixed tab bar;
  // bring them into view (scroll-margin keeps them clear of the bar).
  const answeredNow = question?.type === "mc" ? !!selected : revealed;
  useEffect(() => {
    if (!answeredNow) return;
    const t = setTimeout(() => actionsRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [answeredNow]);

  // Keyboard: 1–4 / a–d pick, Enter/Space continue or reveal, g = guessed, Esc ends.
  useEffect(() => {
    if (finished || !question) return;
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "escape") { e.preventDefault(); endNow(); return; }
      if (question.type === "mc") {
        if (!selected) {
          const idx = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[k];
          if (idx !== undefined && question.options[idx]) { e.preventDefault(); answerMc(question.options[idx]); }
          return;
        }
        if (Date.now() - shownAt.current < 400) return;
        if (k === "g" && selected.correct && !guessed) { e.preventDefault(); setGuessed(true); return; }
        if (k === "enter" || k === " ") { e.preventDefault(); advance(); }
        return;
      }
      if (!revealed) {
        if (k === "enter" || k === " ") { e.preventDefault(); setRevealed(true); }
        return;
      }
      const map = { 1: "wrong", 2: "lucky", 3: "knew", enter: "knew" };
      if (map[k]) { e.preventDefault(); gradeFlip(map[k]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, question, selected, revealed, guessed, answerMc, advance, gradeFlip, endNow]);

  // ── summary ──
  if (finished || !card) {
    const total = results.length;
    const right = results.filter((r) => r.correct).length;
    const missedIds = [...new Set(results.filter((r) => !r.correct).map((r) => r.cardId))];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <GiltPanel inner={{ padding: "24px 20px", gap: 10, alignItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: C.goldDim, letterSpacing: ".22em" }}>SITTING COMPLETE</div>
          <StudyText lang={lang} text={deck.name} style={{ fontFamily: FONT_SERIF, fontSize: 24, color: C.goldPale, whiteSpace: "normal" }} />
          <div style={{ fontFamily: FONT_SERIF, fontSize: 46, fontWeight: 600, color: C.goldPale, lineHeight: 1 }}>
            {total ? Math.round((right / total) * 100) : 0}%
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textDim }}>
            {total === 0 ? "No cards answered." : `${right} of ${total} answers right · best run ${bestStreak}`}
          </div>
        </GiltPanel>
        {missedIds.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 17, color: C.brass }}>Missed this sitting</div>
            {missedIds.map((id) => byId.get(id)).filter(Boolean).map((c) => (
              <div key={c.id} style={{ padding: "11px 14px", borderRadius: 12, background: S.panelFlat, border: `1px solid ${C.ruleSoft}` }}>
                <StudyText lang={lang} text={c.front} style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.goldLight }} />
                <StudyText lang={lang} text={c.back} style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textDim, marginTop: 4 }} />
              </div>
            ))}
          </div>
        )}
        <GoldButton onClick={onExit}>Back to deck</GoldButton>
      </div>
    );
  }

  if (!question) return null;
  const isMc = question.type === "mc";
  const answered = isMc ? !!selected : revealed;
  const remaining = queue.length - pos;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header: progress + end */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: FONT_SANS, fontSize: 11, letterSpacing: ".14em", color: C.goldDim, marginBottom: 6 }}>
            <span className="study-text" lang={lang} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deck.name.toUpperCase()}</span>
            <span style={{ whiteSpace: "nowrap" }}>{remaining} LEFT{streak >= 3 ? ` · ${streak} IN A ROW` : ""}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: C.ruleWarm, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((pos / Math.max(1, queue.length)) * 100)}%`, background: S.segment, transition: "width 0.4s ease" }} />
          </div>
        </div>
        <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }} onClick={endNow}>✕ End</button>
      </div>

      {saveError && (
        <div style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(220,53,69,0.4)", background: "rgba(220,53,69,0.08)", fontFamily: FONT_SANS, fontSize: 12.5, color: "#f5d0d4" }}>
          {saveError}
        </div>
      )}

      {/* Prompt */}
      <GiltPanel inner={{ padding: "22px 20px", gap: 10 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: ".22em", color: C.goldDim }}>
          {question.direction === "back-to-front" ? "WHICH FRONT FITS?" : isMc ? "PICK THE ANSWER" : "RECALL THE ANSWER"}
        </div>
        <StudyText lang={lang} text={question.prompt} style={promptStyle(question.prompt)} />
      </GiltPanel>

      {/* Multiple choice */}
      {isMc && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {question.options.map((opt, i) => {
            const cls = selected ? (opt.correct ? "correct" : opt.id === selected.id ? "wrong" : "") : "";
            return (
              <button key={opt.id} className={`option-btn ${cls}`} disabled={!!selected}
                onClick={() => answerMc(opt)}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: selected && !opt.correct && opt.id !== selected.id ? 0.55 : 1 }}>
                <span style={{ flex: "0 0 auto", fontFamily: FONT_SERIF, color: C.goldDim, fontSize: 15, lineHeight: 1.4 }}>{"ABCD"[i]}</span>
                <span className="study-text" lang={lang} style={{ flex: 1, minWidth: 0 }}>{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Flip: show answer */}
      {!isMc && !revealed && (
        <GoldButton onClick={() => setRevealed(true)}>Show answer</GoldButton>
      )}

      {/* Answer panel */}
      {answered && (
        <div style={{ padding: "16px 18px", borderRadius: 14, background: S.panelFlat, border: `1px solid ${isMc && !selected.correct ? "rgba(220,53,69,0.35)" : C.ruleGold}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {isMc && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: ".18em", color: selected.correct ? C.verdigris : C.sealUpText }}>
              {selected.correct ? "RIGHT" : "NOT QUITE — THE ANSWER"}
            </div>
          )}
          <StudyText lang={lang}
            text={question.direction === "back-to-front" ? card.front : card.back}
            style={{ fontFamily: FONT_SANS, fontSize: 15.5, lineHeight: 1.55, color: C.text }} />
          {card.notes && (
            <StudyText lang={lang} text={card.notes}
              style={{ fontFamily: FONT_SANS, fontSize: 13, lineHeight: 1.55, color: C.textDim, paddingTop: 10, borderTop: `1px solid ${C.rule}` }} />
          )}
          {card.tags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {card.tags.map((t) => (
                <span key={t} className="study-text" lang={lang} style={{ padding: "2px 9px", borderRadius: 10, border: `1px solid ${C.ruleWarm}`, fontFamily: FONT_SANS, fontSize: 11, color: C.goldDim }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Continue / grade */}
      {isMc && selected && (
        <div ref={actionsRef} style={{ display: "flex", gap: 10, scrollMarginBottom: 120 }}>
          {selected.correct && (
            <button className="nav-btn nav-btn-ghost" style={{ flex: 1, opacity: guessed ? 0.6 : 1 }} disabled={guessed} onClick={() => setGuessed(true)}>
              {guessed ? "Marked as guessed" : "I guessed"}
            </button>
          )}
          <button className="nav-btn nav-btn-primary" style={{ flex: 1, whiteSpace: "nowrap" }} onClick={advance}>
            Next →
          </button>
        </div>
      )}
      {!isMc && revealed && (
        <div ref={actionsRef} style={{ display: "flex", gap: 8, scrollMarginBottom: 120 }}>
          <button className="nav-btn nav-btn-ghost" style={{ flex: 1, padding: "12px 6px", borderColor: "rgba(220,53,69,0.4)", color: "#f5d0d4" }} onClick={() => gradeFlip("wrong")}>Missed</button>
          <button className="nav-btn nav-btn-ghost" style={{ flex: 1, padding: "12px 6px" }} onClick={() => gradeFlip("lucky")}>Guessed</button>
          <button className="nav-btn nav-btn-primary" style={{ flex: 1, padding: "12px 6px" }} onClick={() => gradeFlip("knew")}>Knew it</button>
        </div>
      )}

      <div className="kbd-hint" style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.goldFaint, textAlign: "center" }}>
        {isMc ? "1–4 to answer · Enter for next · G = guessed · Esc ends" : "Space to reveal · 1 missed · 2 guessed · 3 knew · Esc ends"}
      </div>
    </div>
  );
}
