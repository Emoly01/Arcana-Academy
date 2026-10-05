// ─── SRS ENGINE ───
// Deck-agnostic: every function here works on a plain per-card state object
// ({ interval, ease, nextReview, streak, totalCorrect, totalAttempts }) and
// knows nothing about tarot. Tarot and study decks share it unchanged.
//
// Intervals are counted in days (SRS_VERSION 3), so mastered cards return
// tomorrow / in 3 days / in a week instead of within the same sitting. A
// failed card comes back after a short relearn delay so it can still be
// re-drilled inside the current session.
export const SRS_VERSION = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RELEARN_MS = 10 * 60 * 1000;

export function getInitialSRS() {
  return { interval: 1, ease: 2.5, nextReview: 0, streak: 0, totalCorrect: 0, totalAttempts: 0 };
}

export function updateSRS(card, correct, confidence = "knew") {
  const now = Date.now();
  let { interval, ease, streak, totalCorrect, totalAttempts } = card;
  totalAttempts++;
  if (correct) {
    totalCorrect++; streak++;
    if (confidence === "lucky") {
      interval = 1;
      ease = Math.max(1.3, ease - 0.1);
    } else {
      if (streak === 1) interval = 1;
      else if (streak === 2) interval = 3;
      else interval = Math.min(Math.round(interval * ease), 180);
      ease = Math.min(3.0, ease + 0.1);
    }
    return { ...card, interval, ease, streak, totalCorrect, totalAttempts, nextReview: now + interval * DAY_MS };
  }
  streak = 0; interval = 1;
  ease = Math.max(1.3, ease - 0.2);
  return { ...card, interval, ease, streak, totalCorrect, totalAttempts, nextReview: now + RELEARN_MS };
}

// Pre-v3 data scheduled reviews in minutes; reinterpreting those intervals as
// days would push cards weeks out, so reset the schedule but keep the history.
export function migrateSrsToDaily(srsData) {
  const migrated = {};
  for (const [id, s] of Object.entries(srsData)) {
    migrated[id] = { ...s, interval: 1, nextReview: 0 };
  }
  return migrated;
}

// Aggregate per-mode stats so the visual quiz and Voice Drill can be compared
// later. Buckets by the raw confidence label the user expressed (voice) or an
// equivalent tag (quiz), plus overall reviewed/correct counts.
export function tallyModeStats(stats, mode, correct, confidenceLevel) {
  const s = { ...(stats || {}) };
  const m = { reviewed: 0, correct: 0, byConfidence: {}, ...(s[mode] || {}) };
  m.byConfidence = { ...(m.byConfidence || {}) };
  m.reviewed += 1;
  if (correct) m.correct += 1;
  const key = confidenceLevel || "unspecified";
  const b = { total: 0, correct: 0, ...(m.byConfidence[key] || {}) };
  b.total += 1;
  if (correct) b.correct += 1;
  m.byConfidence[key] = b;
  s[mode] = m;
  return s;
}

export function getMasteryLevel(srs) {
  if (srs.totalAttempts === 0) return { level: 0, label: "Unknown", icon: "◇" };
  const ratio = srs.totalCorrect / srs.totalAttempts;
  if (ratio >= 0.9 && srs.streak >= 5) return { level: 4, label: "Mastered", icon: "◆" };
  if (ratio >= 0.75 && srs.streak >= 3) return { level: 3, label: "Confident", icon: "◈" };
  if (ratio >= 0.5) return { level: 2, label: "Learning", icon: "◇" };
  return { level: 1, label: "Struggling", icon: "○" };
}
