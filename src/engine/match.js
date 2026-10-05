// ─── FUZZY MATCH ───
// Unicode-aware so German umlauts and ß survive ("Lungenödem" stays intact
// instead of collapsing to "lungendem"). Identical to the old [a-z] filter on
// the tarot meanings, which are plain ASCII.
export function normalize(str) {
  return (str || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();
}

export function fuzzyMatch(input, target) {
  const a = normalize(input);
  const b = normalize(target);
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  // Check if words overlap
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const matches = aWords.filter(w => bWords.some(bw => bw.startsWith(w) || w.startsWith(bw) || levenshtein(w, bw) <= 2));
  if (bWords.length === 0) return 0;
  return matches.length / bWords.length;
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return d[m][n];
}

// Score free recall (typed or spoken) against a list of target meanings.
// Input is split on commas / semicolons / newlines; each fragment claims the
// best unclaimed meaning it fuzzily matches.
export function scoreRecall(input, meanings) {
  const inputParts = input.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (inputParts.length === 0) return { score: 0, matched: [], missed: meanings, total: meanings.length };

  const matched = [];
  const used = new Set();

  for (const part of inputParts) {
    let bestMatch = null;
    let bestScore = 0;
    for (let i = 0; i < meanings.length; i++) {
      if (used.has(i)) continue;
      const s = fuzzyMatch(part, meanings[i]);
      if (s > bestScore && s >= 0.5) {
        bestScore = s;
        bestMatch = i;
      }
    }
    if (bestMatch !== null) {
      matched.push({ input: part, meaning: meanings[bestMatch], score: bestScore });
      used.add(bestMatch);
    }
  }

  const missed = meanings.filter((_, i) => !used.has(i));
  const score = meanings.length > 0 ? matched.length / meanings.length : 0;
  return { score, matched, missed, total: meanings.length };
}
