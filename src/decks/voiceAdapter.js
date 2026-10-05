// ─── VOICE DRILL FOR STUDY DECKS ───
// The drill engine (VoiceDrillMode) is unchanged; a study deck just tells it
// what to read. Front is spoken as the prompt, back is the answer, notes are
// shown (not read) after the reveal, and the TTS voice follows the deck's
// language. Spoken-recall scoring matches against the back split into parts,
// so it works best for keyword-style backs ("A, B, C") and only roughly for
// full sentences — self-graded mode works for anything.
import { buildSessionQueue } from "./questions.js";
import { scoreRecall } from "../engine/match.js";

export function backParts(back) {
  const parts = String(back || "")
    .split(/[\n;,•·]+/)
    .map((p) => p.replace(/^[\s\-–—*]+/, "").trim())
    .filter(Boolean);
  return parts.length ? parts : [String(back || "").trim()].filter(Boolean);
}

export function makeDeckVoiceAdapter(deck) {
  const lang = deck?.language === "en" ? "en" : "de";
  return {
    ttsLang: lang,
    textClass: "study-text",
    title: deck?.name || "",
    showPoolPicker: false,
    promptOf: (item) => item.card.front,
    meaningsOf: (item) => backParts(item.card.back),
    answerTextOf: (item) => item.card.back,
    readoutOf: (item) => item.card.back,
    detailOf: (item) => item.card.notes || "",
  };
}

// Due cards first, then new ones; if neither, every card (weakest first) so a
// drill can always run.
export function buildDeckVoiceQueue(cards, srsMap) {
  let ids = buildSessionQueue(cards, srsMap);
  if (!ids.length) ids = buildSessionQueue(cards, srsMap, { practiceAll: true });
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ids.map((id) => ({ card: byId.get(id), isUpright: true })).filter((x) => x.card);
}

export function scoreDeckRecall(text, card) {
  return scoreRecall(text, backParts(card.back));
}
