// ─── VOICE COMMAND VOCABULARY & PARSER ───
// Pure, framework-free so it can be unit-tested in isolation.
// A small, fixed vocabulary is intentional: it keeps recognition reliable.
// German commands are primary; English fallbacks are accepted. Matching is
// deliberately generous because speech recognition mangles words.

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
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

export function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-zäöüß ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fixed vocabulary. `words` are matched token-by-token (fuzzy); `phrases`
// are matched as substrings of the whole normalized utterance.
const COMMANDS = {
  reveal: {
    words: ["aufdecken", "aufdeck", "aufgedeckt", "decken", "reveal", "auflösen",
            "auflösung", "lösung", "zeig", "zeige", "zeigen", "show", "umdrehen", "dreh"],
  },
  correct: {
    phrases: ["hatte ich", "hab ich", "habe ich", "hatt ich", "wusste ich"],
    words: ["richtig", "korrekt", "correct", "right", "gewusst", "gewußt", "stimmt", "yes", "yep", "ja"],
  },
  wrong: {
    phrases: ["hatte ich nicht", "nicht gewusst", "keine ahnung"],
    words: ["daneben", "falsch", "wrong", "nein", "no", "nope", "verkehrt", "leider"],
  },
  sicher:   { words: ["sicher", "confident", "sure", "safe", "klar"] },
  wackelig: { words: ["wackelig", "wacklig", "unsicher", "unsure", "shaky", "mittel", "naja"] },
  geraten:  { words: ["geraten", "guessed", "guess", "raten", "glück", "lucky", "zufall"] },
  repeat: {
    phrases: ["noch mal", "noch einmal"],
    words: ["wiederholen", "wiederhole", "wiederhol", "wiederholung", "repeat", "nochmal", "again"],
  },
  pause:  { words: ["pause", "pausier", "pausiere", "pausieren"] },
  resume: { words: ["weiter", "weitermachen", "resume", "continue", "fortfahren"] },
  stop: {
    words: ["stopp", "stop", "fertig", "fertisch", "ende", "beenden", "finish",
            "done", "quit", "schluss", "aufhören", "aufhoeren"],
  },
};

function wordMatches(token, word) {
  if (token === word) return true;
  if (word.length >= 4 && (token.startsWith(word) || word.startsWith(token))) return true;
  const thresh = word.length <= 6 ? 1 : 2;
  return lev(token, word) <= thresh;
}

function present(normalized, tokens, spec) {
  if (spec.phrases) {
    for (const p of spec.phrases) if (normalized.includes(p)) return true;
  }
  if (spec.words) {
    for (const w of spec.words) {
      for (const t of tokens) if (wordMatches(t, w)) return true;
    }
  }
  return false;
}

// Parse a raw transcript into a structured set of intents. Multiple intents
// may be present in a single utterance ("hatte ich, sicher").
export function parseUtterance(transcript) {
  const normalized = normalize(transcript);
  const tokens = normalized ? normalized.split(" ") : [];

  const negated = /\bnicht\b/.test(normalized) || tokens.includes("kein");

  let correctP = present(normalized, tokens, COMMANDS.correct);
  let wrongP = present(normalized, tokens, COMMANDS.wrong);
  // Negation flips a "hatte ich" into "hatte ich nicht".
  if (negated) { correctP = false; wrongP = true; }

  const grade = correctP && !wrongP ? "correct"
              : wrongP && !correctP ? "wrong"
              : null;

  const confidence = present(normalized, tokens, COMMANDS.sicher) ? "sicher"
                   : present(normalized, tokens, COMMANDS.wackelig) ? "wackelig"
                   : present(normalized, tokens, COMMANDS.geraten) ? "geraten"
                   : null;

  const reveal = present(normalized, tokens, COMMANDS.reveal);
  const repeat = present(normalized, tokens, COMMANDS.repeat);
  const pause = present(normalized, tokens, COMMANDS.pause);
  const resume = present(normalized, tokens, COMMANDS.resume);
  const stop = present(normalized, tokens, COMMANDS.stop);

  const recognized = reveal || !!grade || !!confidence || repeat || pause || resume || stop;

  return { raw: transcript, normalized, reveal, grade, confidence, repeat, pause, resume, stop, recognized };
}
