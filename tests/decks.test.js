// Run with `npm test` (Node's built-in test runner — no extra dependencies).
// All card content here is deliberately fake placeholder text.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseBulkImport, parseTags, newId, isValidId, deckCards, makeBasicCard,
} from "../src/decks/model.js";
import {
  pickBasicDistractors, generateBasicQuestion, buildSessionQueue, deckCounts,
  optionText, requeueMissed,
} from "../src/decks/questions.js";
import { normalize, scoreRecall } from "../src/engine/match.js";
import { updateSRS, getInitialSRS, DAY_MS, RELEARN_MS } from "../src/engine/srs.js";

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

function card(id, front, back, tags = []) {
  return { id, ...makeBasicCard({ front, back, tags }, 1000) };
}

// ─── import parser ───
test("parses tab and ' | ' separated lines, skipping blanks", () => {
  const r = parseBulkImport("Testkarte 1\tAntwort Eins\n\nTestkarte 2 | Antwort Zwei\n   \n");
  assert.equal(r.rows.length, 2);
  assert.equal(r.validCount, 2);
  assert.deepEqual(r.rows.map((x) => [x.card.front, x.card.back]), [
    ["Testkarte 1", "Antwort Eins"], ["Testkarte 2", "Antwort Zwei"],
  ]);
  assert.equal(r.rows[1].lineNo, 3);
});

test("tab wins over pipe, and a bare | inside text is kept", () => {
  const r = parseBulkImport("A | B\tC|D");
  assert.equal(r.rows[0].card.front, "A | B");
  assert.equal(r.rows[0].card.back, "C|D");
});

test("optional notes and tags columns, plus batch tags", () => {
  const r = parseBulkImport("Vorderseite | Rückseite | eine Notiz | #Platzhalter, Test", { batchTags: "Stapel, test" });
  const c = r.rows[0].card;
  assert.equal(c.notes, "eine Notiz");
  assert.deepEqual(c.tags, ["Platzhalter", "Test", "Stapel"]);
});

test("literal \\n becomes a line break", () => {
  const r = parseBulkImport("Frage | Zeile eins\\nZeile zwei");
  assert.equal(r.rows[0].card.back, "Zeile eins\nZeile zwei");
});

test("flags missing separator, empty back, too many fields", () => {
  const r = parseBulkImport("nur eine Spalte\nFront | \na | b | c | d | e\nTab vorne\t");
  assert.equal(r.validCount, 0);
  assert.match(r.rows[0].errors[0], /No separator/);
  assert.ok(r.rows[1].errors.some((e) => /Back is empty/.test(e)));
  assert.match(r.rows[2].errors[0], /Too many fields/);
  assert.ok(r.rows[3].errors.some((e) => /Back is empty/.test(e)));
});

test("warns on duplicate fronts in deck and within the paste (case-insensitive)", () => {
  const r = parseBulkImport("Übung | x\nübung | y", { existingFronts: ["ÜBUNG"] });
  assert.equal(r.validCount, 2);
  assert.ok(r.rows[0].warnings.some((w) => /already in the deck/.test(w)));
  assert.ok(r.rows[1].warnings.some((w) => /Same front as line 1/.test(w)));
});

test("umlauts, ß and long compound words pass through untouched", () => {
  const word = "Donaudampfschifffahrtsgesellschaftskapitänsmütze";
  const r = parseBulkImport(`${word} | Größe Süßigkeit`);
  assert.equal(r.rows[0].card.front, word);
  assert.equal(r.rows[0].card.back, "Größe Süßigkeit");
});

test("parseTags dedupes case-insensitively and strips #", () => {
  assert.deepEqual(parseTags("#a, A, b ,, #b"), ["a", "b"]);
});

test("ids are valid Firestore field-path segments", () => {
  for (let i = 0; i < 50; i++) assert.ok(isValidId(newId()));
});

// ─── distractors ───
test("distractors prefer shared tags and never repeat the correct answer", () => {
  const target = card("c1", "Q1", "Antwort Alpha", ["gruppe-a"]);
  const pool = [
    target,
    card("c2", "Q2", "Antwort Beta", ["gruppe-a"]),
    card("c3", "Q3", "Antwort Gamma", ["gruppe-a"]),
    card("c4", "Q4", "Antwort Delta", ["gruppe-a"]),
    card("c5", "Q5", "Antwort Epsilon", ["gruppe-b"]),
    card("c6", "Q6", "antwort alpha!", ["gruppe-a"]), // same answer, other card
  ];
  for (let i = 0; i < 20; i++) {
    const d = pickBasicDistractors(target, pool);
    assert.equal(d.length, 3);
    assert.deepEqual(new Set(d.map((x) => x.id)), new Set(["c2", "c3", "c4"]));
  }
});

test("distractors fall back to untagged cards and favour similar length", () => {
  const target = card("t", "Q", "mittel lange Antwort");
  const pool = [target, card("a", "Q", "x"), card("b", "Q", "auch mittel lang"), card("c", "Q", "ziemlich ähnlich lang"),
    card("d", "Q", "eine sehr sehr sehr sehr sehr sehr lange Antwort, die weit über alles hinausgeht")];
  const d = pickBasicDistractors(target, pool, { rand: () => 0 });
  assert.equal(d.length, 3);
  assert.ok(!d.some((x) => x.id === "a") || !d.some((x) => x.id === "d"));
  assert.ok(d.some((x) => x.id === "b") && d.some((x) => x.id === "c"));
});

test("MC question has 4 unique options with exactly one correct", () => {
  const pool = Array.from({ length: 10 }, (_, i) => card(`c${i}`, `Testkarte ${i}`, `Platzhalterantwort ${i}`));
  const q = generateBasicQuestion(pool[0], pool, "front-to-back");
  assert.equal(q.type, "mc");
  assert.equal(q.options.length, 4);
  assert.equal(q.options.filter((o) => o.correct).length, 1);
  assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
  assert.equal(q.prompt, "Testkarte 0");
});

test("small decks fall back to self-graded flip cards", () => {
  const pool = [card("a", "A", "1"), card("b", "B", "2"), card("c", "C", "3")];
  assert.equal(generateBasicQuestion(pool[0], pool, "front-to-back").type, "flip");
});

test("mixed mode only goes back-to-front when the deck allows reversing", () => {
  const pool = Array.from({ length: 6 }, (_, i) => card(`c${i}`, `F${i}`, `B${i}`));
  for (let i = 0; i < 40; i++) {
    const q = generateBasicQuestion(pool[0], pool, "mixed", { reverse: false });
    assert.notEqual(q.direction, "back-to-front");
  }
  const rev = generateBasicQuestion(pool[0], pool, "mixed", { reverse: true, rand: seq(0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5) });
  assert.equal(rev.direction, "back-to-front");
  assert.equal(rev.prompt, "B0");
});

test("optionText clips to the first line", () => {
  assert.equal(optionText("Erste Zeile\nZweite Zeile"), "Erste Zeile");
  assert.ok(optionText("x".repeat(500)).length <= 160);
});

// ─── session queue & per-deck SRS ───
test("queue: due first (most overdue first), then new up to the limit", () => {
  const now = 10 * DAY_MS;
  const cards = ["a", "b", "c", "d", "e"].map((id) => card(id, id, id));
  const srs = {
    a: { ...getInitialSRS(), totalAttempts: 1, nextReview: now + DAY_MS }, // not due
    b: { ...getInitialSRS(), totalAttempts: 2, nextReview: now - 1000 },
    c: { ...getInitialSRS(), totalAttempts: 3, nextReview: now - 5000 },
  };
  assert.deepEqual(buildSessionQueue(cards, srs, { now, newLimit: 1 }), ["c", "b", "d"]);
  assert.deepEqual(deckCounts(cards, srs, now), { total: 5, due: 2, new: 2, learned: 3 });
});

test("practiceAll returns every card", () => {
  const cards = ["a", "b", "c"].map((id) => card(id, id, id));
  assert.equal(buildSessionQueue(cards, {}, { practiceAll: true }).length, 3);
});

test("missed card is requeued a few positions later", () => {
  assert.deepEqual(requeueMissed(["a", "b", "c", "d", "e"], 0, "a", 2), ["a", "b", "c", "a", "d", "e"]);
  assert.deepEqual(requeueMissed(["a", "b"], 1, "b", 3), ["a", "b", "b"]);
});

test("SRS engine behaves as before: 1 → 3 → ×ease days, relearn on miss", () => {
  let s = getInitialSRS();
  const t0 = Date.now();
  s = updateSRS(s, true); assert.equal(s.interval, 1);
  s = updateSRS(s, true); assert.equal(s.interval, 3);
  s = updateSRS(s, true); assert.equal(s.interval, Math.round(3 * 2.7));
  s = updateSRS(s, false);
  assert.equal(s.interval, 1);
  assert.ok(s.nextReview >= t0 + RELEARN_MS && s.nextReview < t0 + RELEARN_MS + 5000);
});

test("deckCards sorts by creation time", () => {
  const deck = { cards: { b: { front: "B", createdAt: 2 }, a: { front: "A", createdAt: 1 } } };
  assert.deepEqual(deckCards(deck).map((c) => c.id), ["a", "b"]);
});

// ─── matching ───
test("normalize keeps umlauts and ß, still strips punctuation", () => {
  assert.equal(normalize("Lungenödem!"), "lungenödem");
  assert.equal(normalize("Größe, Maß."), "größe maß");
  assert.equal(normalize("Self-love needed"), "selflove needed"); // tarot: same as before
});

test("scoreRecall matches German keywords", () => {
  const r = scoreRecall("Platzhalter eins, zwei Ärger", ["Platzhalter eins", "Ärger zwei", "drei"]);
  assert.equal(r.matched.length, 2);
  assert.deepEqual(r.missed, ["drei"]);
});
