// ─── STUDY DECK PERSISTENCE ───
// One listener on arcana-academy/{uid}/decks feeds the deck picker, the deck
// screens and voice drill. Writes touch only the fields they change
// (`srs.<cardId>`, `cards.<cardId>`), so a review never rewrites card content
// and editing a card never resets its schedule.
import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField, increment,
} from "firebase/firestore";
import { newId, isValidId } from "./model.js";

const decksCol = (db, uid) => collection(db, "arcana-academy", uid, "decks");
const deckRef = (db, uid, deckId) => doc(db, "arcana-academy", uid, "decks", deckId);

function assertId(id) {
  if (!isValidId(id)) throw new Error(`Invalid id: ${id}`);
}

export function useDecks(db, uid) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) { setDecks([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(decksCol(db, uid), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, cards: {}, srs: {}, stats: {}, ...d.data() }));
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setDecks(list);
      setError(null);
      setLoading(false);
    }, (err) => {
      console.error("Decks listener error:", err);
      setError(err);
      setLoading(false);
    });
    return () => unsub();
  }, [db, uid]);

  return { decks, loading, error };
}

export async function createDeck(db, uid, { name, language = "de", reverse = false }) {
  const id = newId("d");
  const now = Date.now();
  await setDoc(deckRef(db, uid, id), {
    name: String(name).trim(), template: "basic", language, reverse: !!reverse,
    createdAt: now, updatedAt: now,
    cards: {}, srs: {}, stats: { totalSessions: 0, bestStreak: 0 },
  });
  return id;
}

export function updateDeckMeta(db, uid, deckId, patch) {
  const allowed = {};
  for (const k of ["name", "language", "reverse"]) if (k in patch) allowed[k] = patch[k];
  return updateDoc(deckRef(db, uid, deckId), { ...allowed, updatedAt: Date.now() });
}

export function deleteDeck(db, uid, deckId) {
  return deleteDoc(deckRef(db, uid, deckId));
}

export function saveCard(db, uid, deckId, cardId, card) {
  assertId(cardId);
  return updateDoc(deckRef(db, uid, deckId), {
    [`cards.${cardId}`]: { ...card, updatedAt: Date.now() },
    updatedAt: Date.now(),
  });
}

// Bulk import: chunked so one paste of hundreds of cards stays well inside
// Firestore's per-request limits. Returns the new card ids.
export async function addCards(db, uid, deckId, cards, chunkSize = 200) {
  const ids = [];
  for (let i = 0; i < cards.length; i += chunkSize) {
    const patch = { updatedAt: Date.now() };
    for (const card of cards.slice(i, i + chunkSize)) {
      const id = newId("c");
      ids.push(id);
      patch[`cards.${id}`] = card;
    }
    await updateDoc(deckRef(db, uid, deckId), patch);
  }
  return ids;
}

export function deleteCard(db, uid, deckId, cardId) {
  assertId(cardId);
  return updateDoc(deckRef(db, uid, deckId), {
    [`cards.${cardId}`]: deleteField(),
    [`srs.${cardId}`]: deleteField(),
    updatedAt: Date.now(),
  });
}

export function writeCardSrs(db, uid, deckId, cardId, srsState) {
  assertId(cardId);
  const { meaningHits, ...clean } = srsState; // tarot-only field
  return updateDoc(deckRef(db, uid, deckId), { [`srs.${cardId}`]: clean });
}

export function recordDeckSession(db, uid, deckId, { bestStreak = 0, previousBest = 0 } = {}) {
  const patch = { "stats.totalSessions": increment(1) };
  if (bestStreak > previousBest) patch["stats.bestStreak"] = bestStreak;
  return updateDoc(deckRef(db, uid, deckId), patch);
}
