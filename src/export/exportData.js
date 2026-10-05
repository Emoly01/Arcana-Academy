import { collection, doc, getDoc, getDocs } from "firebase/firestore";

// ─── DATA EXPORT ───
// A full snapshot of everything Arcana stores for the signed-in user, saved as
// a JSON file: the tarot doc (SRS history, notes, stats), every study deck, and
// the localStorage mirror. Read-only — nothing here writes to Firestore.
export async function collectUserData(db, uid) {
  const rootSnap = await getDoc(doc(db, "arcana-academy", uid));

  // Decks live in a subcollection; a failed read there must not cost the
  // tarot export, so it is reported inside the file instead of thrown.
  let decks = {};
  let decksError = null;
  try {
    const deckSnaps = await getDocs(collection(db, "arcana-academy", uid, "decks"));
    deckSnaps.forEach((d) => { decks[d.id] = d.data(); });
  } catch (err) {
    decksError = String(err?.message || err);
  }

  let localMirror = null;
  try {
    const raw = localStorage.getItem("arcana-academy-v2");
    localMirror = raw ? JSON.parse(raw) : null;
  } catch (e) { /* unavailable or unparsable */ }

  return {
    exportedAt: new Date().toISOString(),
    format: "arcana-academy-export/1",
    uid,
    firestore: {
      [`arcana-academy/${uid}`]: rootSnap.exists() ? rootSnap.data() : null,
      decks,
      ...(decksError ? { decksError } : {}),
    },
    localStorage: { "arcana-academy-v2": localMirror },
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportUserData(db, uid) {
  const data = await collectUserData(db, uid);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(data, `arcana-academy-export-${stamp}.json`);
  return data;
}
