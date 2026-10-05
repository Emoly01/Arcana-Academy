// ─── STUDY DECK MODEL ───
// Tarot is a built-in deck whose cards live in code and whose progress stays in
// the original arcana-academy/{uid} doc. Every other deck is one Firestore doc:
//
//   arcana-academy/{uid}/decks/{deckId}
//   { name, template: "basic", language: "de", reverse: false,
//     createdAt, updatedAt,
//     cards: { [cardId]: { front, back, notes, tags, image, createdAt, updatedAt } },
//     srs:   { [cardId]: { interval, ease, nextReview, streak, totalCorrect, totalAttempts } },
//     stats: { totalSessions, bestStreak } }
//
// `image` is reserved for v2 (ECG strips, defect diagrams): it will hold a
// Firebase Storage reference ({ path, alt, w, h }), never inline image data.

export const TAROT_DECK_ID = "tarot";

export const TEMPLATES = {
  basic: { key: "basic", label: "Basic", fields: ["front", "back", "notes", "tags"] },
};

export const LANGUAGES = [
  { key: "de", label: "Deutsch" },
  { key: "en", label: "English" },
];

// Firestore caps a document at 1 MiB; warn well before a deck gets there.
export const DECK_SOFT_LIMIT_BYTES = 800 * 1024;
export const DECK_HARD_LIMIT_BYTES = 1000 * 1024;

export const FIELD_MAX = { front: 2000, back: 4000, notes: 6000, tag: 60, deckName: 80 };

// IDs double as Firestore field-path segments (`cards.<id>`), so they are
// restricted to [a-z0-9] and always start with a letter.
export function newId(prefix = "c") {
  let rand = "";
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(2);
    cryptoObj.getRandomValues(buf);
    rand = buf[0].toString(36) + buf[1].toString(36);
  } else {
    rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  return `${prefix}${Date.now().toString(36)}${rand}`.slice(0, 24);
}

export function isValidId(id) {
  return typeof id === "string" && /^[a-z][a-z0-9]{2,40}$/.test(id);
}

// Tags are comma-separated; a leading "#" is accepted and dropped. Duplicates
// are removed case-insensitively, keeping the first spelling.
export function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input || "").split(",");
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const t = String(raw).trim().replace(/^#+/, "").trim().slice(0, FIELD_MAX.tag);
    if (!t) continue;
    const key = t.toLocaleLowerCase("de");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function tagKey(tag) {
  return String(tag).toLocaleLowerCase("de");
}

// A literal "\n" typed into a one-line import field becomes a real line break.
export function unescapeField(text) {
  return String(text || "").replace(/\\n/g, "\n");
}

export function makeBasicCard({ front, back, notes = "", tags = [] }, now = Date.now()) {
  return {
    front: String(front || "").trim(),
    back: String(back || "").trim(),
    notes: String(notes || "").trim(),
    tags: parseTags(tags),
    image: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateCard(card) {
  const errors = [];
  if (!card.front) errors.push("Front is empty");
  if (!card.back) errors.push("Back is empty");
  if (card.front.length > FIELD_MAX.front) errors.push(`Front is longer than ${FIELD_MAX.front} characters`);
  if (card.back.length > FIELD_MAX.back) errors.push(`Back is longer than ${FIELD_MAX.back} characters`);
  if (card.notes && card.notes.length > FIELD_MAX.notes) errors.push(`Notes are longer than ${FIELD_MAX.notes} characters`);
  return errors;
}

export function frontKey(front) {
  return String(front || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
}

// ─── BULK IMPORT ───
// One card per line: front, back, optional notes, optional tags. Fields are
// separated by a tab (wins if present — what spreadsheets paste) or by a pipe
// with whitespace (or the line edge) on both sides: "a | b", "a | b | | tag",
// "a | b |". A bare "|" inside text ("C|D") is left alone.
function splitOnPipes(line) {
  const fields = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "|") continue;
    const before = i === 0 || /\s/.test(line[i - 1]);
    const after = i === line.length - 1 || /\s/.test(line[i + 1]);
    if (before && after) {
      fields.push(line.slice(start, i));
      start = i + 1;
    }
  }
  fields.push(line.slice(start));
  return fields.map((f) => f.trim());
}

export function splitImportLine(line) {
  if (line.includes("\t")) return { fields: line.split("\t"), separator: "tab" };
  const fields = splitOnPipes(line);
  if (fields.length > 1) return { fields, separator: "pipe" };
  return { fields: [line], separator: null };
}

export function parseBulkImport(text, { existingFronts = [], batchTags = [] } = {}) {
  const existing = new Set(existingFronts.map(frontKey));
  const extraTags = parseTags(batchTags);
  const seenInPaste = new Map();
  const rows = [];

  String(text || "").split(/\r?\n/).forEach((rawLine, idx) => {
    // Strip trailing spaces but not tabs: "Front<TAB>" means an empty back.
    const line = rawLine.replace(/[ \r]+$/, "");
    if (!line.trim()) return;
    const lineNo = idx + 1;
    const { fields, separator } = splitImportLine(line);
    const errors = [];
    const warnings = [];

    if (!separator) {
      errors.push("No separator found — use a tab or \" | \" between front and back");
    } else if (fields.length > 4) {
      errors.push(`Too many fields (${fields.length}) — expected front, back, notes, tags`);
    }

    const [front = "", back = "", notes = "", tags = ""] = fields.map((f) => unescapeField(f).trim());
    const card = makeBasicCard({ front, back, notes, tags: [...parseTags(tags), ...extraTags] });
    if (separator && fields.length <= 4) errors.push(...validateCard(card));

    const key = frontKey(card.front);
    if (card.front) {
      if (existing.has(key)) warnings.push("A card with this front is already in the deck");
      if (seenInPaste.has(key)) warnings.push(`Same front as line ${seenInPaste.get(key)}`);
      else seenInPaste.set(key, lineNo);
    }
    if (card.front && card.back && frontKey(card.front) === frontKey(card.back)) {
      warnings.push("Front and back are identical");
    }

    rows.push({ lineNo, raw: line, card, errors, warnings, ok: errors.length === 0 });
  });

  return {
    rows,
    validCount: rows.filter((r) => r.ok).length,
    errorCount: rows.filter((r) => !r.ok).length,
    warningCount: rows.filter((r) => r.ok && r.warnings.length > 0).length,
  };
}

// ─── DECK HELPERS ───
export function deckCards(deck) {
  return Object.entries(deck?.cards || {})
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id));
}

export function estimateBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch (e) {
    return JSON.stringify(value).length * 2;
  }
}

export function deckAllTags(cards) {
  const map = new Map();
  for (const c of cards) {
    for (const t of c.tags || []) {
      const k = tagKey(t);
      if (!map.has(k)) map.set(k, { tag: t, count: 0 });
      map.get(k).count++;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
}
