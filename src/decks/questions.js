// ─── BASIC-CARD QUESTIONS, DISTRACTORS & SESSION QUEUE ───
import { shuffle } from "../engine/random.js";
import { normalize } from "../engine/match.js";
import { tagKey } from "./model.js";

export const OPTION_MAX_CHARS = 160;
export const NEW_PER_SESSION = 20;

// Multiple-choice options show the first line of a field, clipped, so a long
// explanatory back doesn't turn four options into four paragraphs. The full
// text is revealed after answering.
export function optionText(text, max = OPTION_MAX_CHARS) {
  const first = String(text || "").split("\n").find((l) => l.trim()) || "";
  const t = first.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function sameAnswer(a, b) {
  return normalize(optionText(a)) === normalize(optionText(b));
}

// Wrong answers for a basic card, drawn from the same deck. Ranking:
//   1. shared tags (dominant) — a tagged card's neighbours are the plausible mixups
//   2. similar answer length — so the correct option doesn't stand out by size
//   3. a little randomness — so the same trio doesn't always appear
// Cards whose answer reads the same as the correct one are never offered.
export function pickBasicDistractors(correct, pool, { count = 3, field = "back", rand = Math.random } = {}) {
  const correctTags = new Set((correct.tags || []).map(tagKey));
  const correctLen = optionText(correct[field]).length;
  const seenTexts = [correct[field]];

  const scored = pool
    .filter((c) => c.id !== correct.id && c[field] && !sameAnswer(c[field], correct[field]))
    .map((c) => {
      const shared = (c.tags || []).filter((t) => correctTags.has(tagKey(t))).length;
      const len = optionText(c[field]).length;
      const lenSim = 1 - Math.abs(len - correctLen) / Math.max(len, correctLen, 1);
      return { card: c, shared, score: shared * 10 + lenSim * 3 + rand() * 1.5 };
    })
    .sort((a, b) => b.score - a.score);

  const picked = [];
  for (const s of scored) {
    if (picked.length >= count) break;
    // Two distractors that read the same would leave a give-away option.
    if (seenTexts.some((t) => sameAnswer(t, s.card[field]))) continue;
    seenTexts.push(s.card[field]);
    picked.push(s.card);
  }
  return picked;
}

// Modes: "front-to-back" | "back-to-front" (MC) | "flip" (self-graded) | "mixed".
// MC needs three distinct wrong answers; with fewer the card is asked as a flip.
export function generateBasicQuestion(card, pool, mode = "mixed", { reverse = false, rand = Math.random } = {}) {
  let picked = mode;
  if (mode === "mixed") {
    const modes = ["front-to-back", "front-to-back", "flip", ...(reverse ? ["back-to-front"] : [])];
    picked = modes[Math.floor(rand() * modes.length)];
  }

  if (picked === "front-to-back" || picked === "back-to-front") {
    const forward = picked === "front-to-back";
    const askField = forward ? "front" : "back";
    const answerField = forward ? "back" : "front";
    const distractors = pickBasicDistractors(card, pool, { field: answerField, rand });
    if (distractors.length >= 3) {
      const options = shuffle([
        { id: card.id, text: optionText(card[answerField]), full: card[answerField], correct: true },
        ...distractors.map((d) => ({ id: d.id, text: optionText(d[answerField]), full: d[answerField], correct: false })),
      ]);
      return { type: "mc", direction: picked, prompt: card[askField], card, options };
    }
  }

  return { type: "flip", direction: "front-to-back", prompt: card.front, answer: card.back, card };
}

// ─── SESSION QUEUE ───
// Due reviews first (most overdue first), then up to `newLimit` unseen cards in
// the order they were added. A deck with nothing due and nothing new can still
// be practised: `practiceAll` returns every card, weakest first.
export function isNew(srs) {
  return !srs || !srs.totalAttempts;
}

export function deckCounts(cards, srsMap = {}, now = Date.now()) {
  let due = 0, fresh = 0, learned = 0;
  for (const c of cards) {
    const s = srsMap[c.id];
    if (isNew(s)) fresh++;
    else {
      learned++;
      if (s.nextReview <= now) due++;
    }
  }
  return { total: cards.length, due, new: fresh, learned };
}

export function buildSessionQueue(cards, srsMap = {}, { now = Date.now(), newLimit = NEW_PER_SESSION, practiceAll = false } = {}) {
  if (practiceAll) {
    const ratio = (c) => {
      const s = srsMap[c.id];
      return isNew(s) ? -1 : s.totalCorrect / s.totalAttempts;
    };
    return shuffle(cards).sort((a, b) => ratio(a) - ratio(b)).map((c) => c.id);
  }
  const due = cards
    .filter((c) => !isNew(srsMap[c.id]) && srsMap[c.id].nextReview <= now)
    .sort((a, b) => srsMap[a.id].nextReview - srsMap[b.id].nextReview);
  const fresh = cards.filter((c) => isNew(srsMap[c.id])).slice(0, Math.max(0, newLimit));
  return [...due, ...fresh].map((c) => c.id);
}

// A missed card comes back a few questions later in the same sitting (its SRS
// relearn delay is ten minutes, which a short session would never reach).
export const RELEARN_GAP = 3;

export function requeueMissed(queue, position, cardId, gap = RELEARN_GAP) {
  const next = [...queue];
  const at = Math.min(position + 1 + gap, next.length);
  next.splice(at, 0, cardId);
  return next;
}
