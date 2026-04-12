import { useState, useEffect, useCallback, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

// ─── FIREBASE CONFIG ───
// Uses your existing dnd-tools-1dd87 project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "dnd-tools-1dd87.firebaseapp.com",
  projectId: "dnd-tools-1dd87",
  storageBucket: "dnd-tools-1dd87.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── TAROT DATA ───
const MAJOR_ARCANA = [
  { id: 0, name: "The Fool", numeral: "0", upright: ["New beginnings", "Innocence", "Spontaneity", "Free spirit", "Leap of faith"], reversed: ["Recklessness", "Naivety", "Risk-taking", "Holding back", "Poor judgment"], element: "Air", keywords: "Beginning the journey, trust in the universe", description: "A young traveler steps toward the edge of a cliff, carefree and trusting. The Fool represents pure potential — the moment before everything begins." },
  { id: 1, name: "The Magician", numeral: "I", upright: ["Willpower", "Manifestation", "Resourcefulness", "Skill", "Concentration"], reversed: ["Manipulation", "Trickery", "Untapped talents", "Deception", "Illusions"], element: "Mercury", keywords: "Channeling power, making it happen", description: "With one hand raised to the heavens and the other pointing to earth, the Magician channels cosmic energy into reality. All four suit tools lie before them." },
  { id: 2, name: "The High Priestess", numeral: "II", upright: ["Intuition", "Mystery", "Subconscious", "Inner voice", "Divine feminine"], reversed: ["Secrets", "Withdrawal", "Silence", "Repressed intuition", "Surface knowledge"], element: "Moon", keywords: "Hidden knowledge, trust your gut", description: "She sits between two pillars — light and dark — guarding the veil to the subconscious. She knows what you know but haven't admitted yet." },
  { id: 3, name: "The Empress", numeral: "III", upright: ["Abundance", "Nurturing", "Fertility", "Nature", "Sensuality"], reversed: ["Dependence", "Smothering", "Creative block", "Neglect", "Emptiness"], element: "Venus", keywords: "Creation, mothering, earthly pleasure", description: "Surrounded by lush nature and ripe grain, the Empress embodies creation in all its forms — art, children, gardens, love. She is abundance incarnate." },
  { id: 4, name: "The Emperor", numeral: "IV", upright: ["Authority", "Structure", "Control", "Fatherhood", "Stability"], reversed: ["Tyranny", "Rigidity", "Domination", "Inflexibility", "Lack of discipline"], element: "Aries", keywords: "Order, leadership, the established world", description: "Seated on a stone throne carved with ram heads, the Emperor rules through structure and will. He is the architect of civilization, for better or worse." },
  { id: 5, name: "The Hierophant", numeral: "V", upright: ["Tradition", "Conformity", "Spiritual wisdom", "Institutions", "Mentorship"], reversed: ["Rebellion", "Subversion", "Unconventionality", "Freedom", "Challenging the status quo"], element: "Taurus", keywords: "Teachings, belief systems, the bridge between", description: "A religious figure raises his hand in blessing between two acolytes. He represents the established path to spiritual knowledge — doctrine, tradition, the teacher." },
  { id: 6, name: "The Lovers", numeral: "VI", upright: ["Love", "Harmony", "Relationships", "Choices", "Alignment"], reversed: ["Disharmony", "Imbalance", "Misalignment", "Indecision", "Self-love needed"], element: "Gemini", keywords: "Union, choice, values alignment", description: "Two figures stand beneath an angel's blessing. But this card isn't just romance — it's about the choices that define who you become." },
  { id: 7, name: "The Chariot", numeral: "VII", upright: ["Determination", "Willpower", "Victory", "Control", "Direction"], reversed: ["Lack of control", "Aggression", "No direction", "Obstacles", "Defeat"], element: "Cancer", keywords: "Moving forward through sheer will", description: "A warrior rides forward pulled by two sphinxes — one black, one white. Victory comes not from force but from holding opposing forces in balance." },
  { id: 8, name: "Strength", numeral: "VIII", upright: ["Courage", "Inner strength", "Patience", "Compassion", "Quiet power"], reversed: ["Self-doubt", "Weakness", "Insecurity", "Raw emotion", "Giving up"], element: "Leo", keywords: "Gentle mastery, taming the beast within", description: "A figure gently closes a lion's mouth — not through force, but through calm, patient love. True strength whispers; it doesn't roar." },
  { id: 9, name: "The Hermit", numeral: "IX", upright: ["Soul-searching", "Introspection", "Solitude", "Inner guidance", "Wisdom"], reversed: ["Isolation", "Loneliness", "Withdrawal", "Lost", "Anti-social"], element: "Virgo", keywords: "Going inward, the lantern in the dark", description: "An old figure stands alone on a mountain, holding a lantern. The Hermit has stepped away from the world to find truth that only silence can teach." },
  { id: 10, name: "Wheel of Fortune", numeral: "X", upright: ["Change", "Cycles", "Fate", "Luck", "Turning points"], reversed: ["Bad luck", "Resistance to change", "Breaking cycles", "External forces", "Stagnation"], element: "Jupiter", keywords: "What goes around comes around", description: "The great wheel turns, carrying figures up and down. Nothing lasts — not the good, not the bad. The only constant is the turning." },
  { id: 11, name: "Justice", numeral: "XI", upright: ["Fairness", "Truth", "Cause and effect", "Law", "Accountability"], reversed: ["Injustice", "Dishonesty", "Lack of accountability", "Unfairness", "Avoidance"], element: "Libra", keywords: "Truth, consequences, the scales balance", description: "A crowned figure holds a sword in one hand and scales in the other. Justice isn't kind or cruel — it simply is what the truth demands." },
  { id: 12, name: "The Hanged Man", numeral: "XII", upright: ["Surrender", "New perspective", "Letting go", "Pause", "Sacrifice"], reversed: ["Stalling", "Resistance", "Indecision", "Martyrdom", "Needless sacrifice"], element: "Neptune", keywords: "Suspension, seeing the world upside down", description: "A figure hangs upside down from one foot, serene. This isn't punishment — it's voluntary surrender, choosing to see everything from a different angle." },
  { id: 13, name: "Death", numeral: "XIII", upright: ["Endings", "Transformation", "Transition", "Release", "Inevitable change"], reversed: ["Resistance to change", "Fear of endings", "Stagnation", "Decay", "Inability to move on"], element: "Scorpio", keywords: "The door closes so another can open", description: "The skeleton rider comes for all — king and pauper alike. But Death isn't destruction; it's the composting that makes new growth possible." },
  { id: 14, name: "Temperance", numeral: "XIV", upright: ["Balance", "Moderation", "Patience", "Purpose", "Harmony"], reversed: ["Excess", "Imbalance", "Impatience", "Misalignment", "Lack of purpose"], element: "Sagittarius", keywords: "The middle path, divine alchemy", description: "An angel pours water between two cups in an endless flow. Temperance is the art of mixing — finding the blend that turns lead into gold." },
  { id: 15, name: "The Devil", numeral: "XV", upright: ["Bondage", "Materialism", "Shadow self", "Attachment", "Addiction"], reversed: ["Release", "Breaking free", "Reclaiming power", "Detachment", "Revelation"], element: "Capricorn", keywords: "Chains you chose, chains you can drop", description: "Two figures stand chained to the Devil's pedestal — but the chains are loose. They could leave anytime. The Devil's greatest trick is making you think you can't." },
  { id: 16, name: "The Tower", numeral: "XVI", upright: ["Upheaval", "Sudden change", "Revelation", "Awakening", "Destruction"], reversed: ["Avoidance of disaster", "Fear of change", "Delayed destruction", "Resisting the inevitable", "Near miss"], element: "Mars", keywords: "Lightning strikes, the lie collapses", description: "Lightning splits a tower and figures fall. It's violent and sudden — but what the Tower destroys was never built on truth. Painful liberation." },
  { id: 17, name: "The Star", numeral: "XVII", upright: ["Hope", "Renewal", "Inspiration", "Serenity", "Spirituality"], reversed: ["Despair", "Disconnection", "Lack of faith", "Discouragement", "Insecurity"], element: "Aquarius", keywords: "After the storm, the sky clears", description: "A naked figure kneels by a pool, pouring water onto land and into the stream. After the Tower's destruction, the Star is the quiet promise: it will be okay." },
  { id: 18, name: "The Moon", numeral: "XVIII", upright: ["Illusion", "Fear", "Anxiety", "Subconscious", "Intuition"], reversed: ["Release of fear", "Clarity", "Truth revealed", "Repressed emotions", "Inner confusion"], element: "Pisces", keywords: "The path through the dark forest", description: "A winding path stretches between two towers under a full moon. A dog and wolf howl, a crayfish crawls from water. Nothing is as it seems here." },
  { id: 19, name: "The Sun", numeral: "XIX", upright: ["Joy", "Success", "Vitality", "Warmth", "Positivity"], reversed: ["Temporary depression", "Lack of success", "Sadness", "Overly optimistic", "Blocked joy"], element: "Sun", keywords: "Pure, uncomplicated happiness", description: "A child rides a white horse under a blazing sun, sunflowers blooming behind. This is the card of yes — of warmth without shadow, joy without footnote." },
  { id: 20, name: "Judgement", numeral: "XX", upright: ["Reflection", "Reckoning", "Rebirth", "Absolution", "Inner calling"], reversed: ["Self-doubt", "Lack of self-awareness", "Failure to learn", "Ignoring the call", "Harsh self-judgment"], element: "Pluto", keywords: "The trumpet sounds. Rise.", description: "An angel blows a trumpet and figures rise from coffins, arms outstretched. This isn't punishment — it's the moment you answer the call of who you're meant to be." },
  { id: 21, name: "The World", numeral: "XXI", upright: ["Completion", "Integration", "Accomplishment", "Wholeness", "Travel"], reversed: ["Incompletion", "Shortcuts", "Stagnation", "Lack of closure", "Emptiness"], element: "Saturn", keywords: "The dance at the end of the journey", description: "A figure dances within a laurel wreath, the four elements at the corners. The cycle is complete. You've arrived — and the next journey is about to begin." },
];

const MINOR_ARCANA_SUITS = {
  Wands: { element: "Fire", theme: "Passion, creativity, ambition, energy", color: "#e85d26" },
  Cups: { element: "Water", theme: "Emotions, relationships, intuition, feelings", color: "#4a90d9" },
  Swords: { element: "Air", theme: "Intellect, conflict, truth, communication", color: "#a0aec0" },
  Pentacles: { element: "Earth", theme: "Material world, finances, health, work", color: "#d4a742" },
};

const COURT_NAMES = ["Page", "Knight", "Queen", "King"];
const PIP_NAMES = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

const MINOR_DATA = {
  Wands: {
    pips: [
      { upright: ["Inspiration", "New venture", "Creation", "Potential"], reversed: ["Delays", "Lack of motivation", "Missed opportunity"], keywords: "A spark ignites" },
      { upright: ["Planning", "Future vision", "Progress", "Decisions"], reversed: ["Fear of unknown", "Lack of planning", "Discontentment"], keywords: "Looking ahead from the castle" },
      { upright: ["Expansion", "Foresight", "Overseas opportunities"], reversed: ["Obstacles", "Delays", "Frustration"], keywords: "Ships on the horizon" },
      { upright: ["Celebration", "Harmony", "Homecoming", "Community"], reversed: ["Lack of support", "Instability", "Feeling unwelcome"], keywords: "Joyful gathering" },
      { upright: ["Competition", "Conflict", "Tension", "Diversity of opinion"], reversed: ["Avoiding conflict", "Inner conflict", "Resolution"], keywords: "Chaotic struggle" },
      { upright: ["Victory", "Recognition", "Success", "Public acclaim"], reversed: ["Ego", "Fall from grace", "Private achievement"], keywords: "The laurel crown" },
      { upright: ["Defensiveness", "Perseverance", "Standing your ground"], reversed: ["Giving up", "Overwhelmed", "Compromise"], keywords: "Holding the high ground" },
      { upright: ["Speed", "Movement", "Quick action", "Air travel"], reversed: ["Delays", "Frustration", "Scattered energy"], keywords: "Everything moves at once" },
      { upright: ["Resilience", "Persistence", "Last stand", "Boundaries"], reversed: ["Exhaustion", "Stubbornness", "Giving in"], keywords: "Battered but standing" },
      { upright: ["Burden", "Responsibility", "Hard work", "Stress"], reversed: ["Release", "Delegation", "Burnout"], keywords: "Carrying too much" },
    ],
    court: [
      { upright: ["Enthusiasm", "Exploration", "Discovery", "Free spirit"], reversed: ["Setbacks", "Lack of direction", "Procrastination"], keywords: "Eager young messenger" },
      { upright: ["Energy", "Passion", "Adventure", "Impulsiveness"], reversed: ["Haste", "Scattered energy", "Delays in travel"], keywords: "Charging forward" },
      { upright: ["Confidence", "Independence", "Determination", "Warmth"], reversed: ["Selfishness", "Jealousy", "Demanding"], keywords: "The sunflower throne" },
      { upright: ["Leadership", "Vision", "Entrepreneurship", "Honor"], reversed: ["Impulsiveness", "Ruthlessness", "High expectations"], keywords: "The visionary ruler" },
    ],
  },
  Cups: {
    pips: [
      { upright: ["New love", "Emotional beginning", "Compassion", "Creativity"], reversed: ["Emotional loss", "Blocked creativity", "Emptiness"], keywords: "The overflowing chalice" },
      { upright: ["Partnership", "Unity", "Attraction", "Connection"], reversed: ["Imbalance", "Broken communication", "Tension"], keywords: "Two becoming one" },
      { upright: ["Celebration", "Friendship", "Community", "Creativity"], reversed: ["Overindulgence", "Gossip", "Isolation"], keywords: "Raising glasses together" },
      { upright: ["Apathy", "Contemplation", "Disconnection", "Reevaluation"], reversed: ["Awareness", "Acceptance", "Moving forward"], keywords: "Bored under the tree" },
      { upright: ["Loss", "Grief", "Regret", "Disappointment"], reversed: ["Acceptance", "Moving on", "Finding peace"], keywords: "Three spilled, two standing" },
      { upright: ["Nostalgia", "Childhood memories", "Innocence", "Joy"], reversed: ["Living in the past", "Unrealistic", "Leaving home"], keywords: "The garden of memory" },
      { upright: ["Fantasy", "Illusion", "Wishful thinking", "Choices"], reversed: ["Alignment", "Personal values", "Overwhelmed by choices"], keywords: "Castles in the clouds" },
      { upright: ["Walking away", "Disillusionment", "Leaving behind", "Searching"], reversed: ["Avoidance", "Fear of change", "Stagnation"], keywords: "Turning your back" },
      { upright: ["Contentment", "Satisfaction", "Gratitude", "Wish fulfilled"], reversed: ["Greed", "Dissatisfaction", "Materialism"], keywords: "The wish card" },
      { upright: ["Harmony", "Family", "Fulfillment", "Emotional security"], reversed: ["Dysfunction", "Broken home", "Misalignment"], keywords: "The rainbow over home" },
    ],
    court: [
      { upright: ["Creativity", "Intuition", "Sensitivity", "New idea"], reversed: ["Emotional immaturity", "Escapism", "Insecurity"], keywords: "Dreamy young mystic" },
      { upright: ["Romance", "Charm", "Imagination", "Following the heart"], reversed: ["Moodiness", "Unrealistic expectations", "Jealousy"], keywords: "The romantic quest" },
      { upright: ["Compassion", "Emotional security", "Intuition", "Calm"], reversed: ["Codependency", "Insecurity", "Smothering"], keywords: "Emotional depth on the throne" },
      { upright: ["Emotional balance", "Generosity", "Diplomacy", "Wisdom"], reversed: ["Emotional manipulation", "Volatility", "Coldness"], keywords: "The wise counselor" },
    ],
  },
  Swords: {
    pips: [
      { upright: ["Clarity", "Breakthrough", "New idea", "Mental force"], reversed: ["Confusion", "Chaos", "Brutality", "Misuse of power"], keywords: "The crowned blade" },
      { upright: ["Difficult choice", "Stalemate", "Avoidance", "Blocked emotions"], reversed: ["Indecision", "Information overload", "Lesser of two evils"], keywords: "Blindfolded balance" },
      { upright: ["Heartbreak", "Grief", "Sorrow", "Painful truth"], reversed: ["Recovery", "Forgiveness", "Releasing pain"], keywords: "Three swords through the heart" },
      { upright: ["Rest", "Recuperation", "Contemplation", "Passive"], reversed: ["Burnout", "Restlessness", "Stagnation"], keywords: "The tomb of rest" },
      { upright: ["Conflict", "Defeat", "Winning at all costs", "Bullying"], reversed: ["Reconciliation", "Making amends", "Past resentment"], keywords: "The hollow victory" },
      { upright: ["Transition", "Moving on", "Leaving behind", "Travel"], reversed: ["Unfinished business", "Resistance", "Stuck"], keywords: "The boat to calmer waters" },
      { upright: ["Deception", "Strategy", "Stealth", "Betrayal"], reversed: ["Coming clean", "Conscience", "Getting caught"], keywords: "Sneaking away with the swords" },
      { upright: ["Restriction", "Imprisonment", "Victim mentality", "Self-imposed"], reversed: ["Freedom", "Release", "New perspective"], keywords: "Blindfolded and bound" },
      { upright: ["Anxiety", "Worry", "Fear", "Nightmares", "Despair"], reversed: ["Hope", "Recovery", "Reaching out"], keywords: "The nightmare card" },
      { upright: ["Endings", "Loss", "Betrayal", "Rock bottom", "Finality"], reversed: ["Recovery", "Regeneration", "Resisting endings"], keywords: "The painful conclusion" },
    ],
    court: [
      { upright: ["Curiosity", "Mental agility", "New ideas", "Thirst for knowledge"], reversed: ["Deception", "Manipulation", "All talk"], keywords: "The vigilant scout" },
      { upright: ["Ambition", "Fast-thinking", "Action-oriented", "Driven"], reversed: ["Restlessness", "Unfocused", "Burnout"], keywords: "Charging into battle" },
      { upright: ["Independence", "Clear thinking", "Direct communication", "Boundaries"], reversed: ["Coldness", "Cruelty", "Bitterness"], keywords: "The clear-eyed ruler" },
      { upright: ["Authority", "Intellect", "Truth", "Ethical leadership"], reversed: ["Tyranny", "Abuse of power", "Manipulation"], keywords: "The judge and strategist" },
    ],
  },
  Pentacles: {
    pips: [
      { upright: ["New opportunity", "Prosperity", "Manifestation", "Abundance"], reversed: ["Lost opportunity", "Lack of planning", "Missed chance"], keywords: "The golden hand" },
      { upright: ["Balance", "Adaptability", "Time management", "Juggling priorities"], reversed: ["Overwhelm", "Imbalance", "Disorganization"], keywords: "Keeping all balls in the air" },
      { upright: ["Teamwork", "Collaboration", "Skill", "Learning"], reversed: ["Lack of teamwork", "Mediocrity", "Disengagement"], keywords: "The master craftsman" },
      { upright: ["Security", "Control", "Conservation", "Stability"], reversed: ["Greed", "Materialism", "Hoarding", "Possessiveness"], keywords: "Holding tight to what you have" },
      { upright: ["Financial loss", "Poverty", "Isolation", "Insecurity"], reversed: ["Recovery", "Improvement", "Spiritual wealth"], keywords: "Out in the cold" },
      { upright: ["Generosity", "Charity", "Prosperity", "Sharing wealth"], reversed: ["Debt", "Selfishness", "One-sided charity"], keywords: "The balance of giving" },
      { upright: ["Patience", "Investment", "Long-term view", "Perseverance"], reversed: ["Impatience", "Bad investment", "Limited results"], keywords: "Waiting for the harvest" },
      { upright: ["Craftsmanship", "Skill development", "Diligence", "Mastery"], reversed: ["Perfectionism", "Lack of ambition", "Repetitive work"], keywords: "The focused artisan" },
      { upright: ["Luxury", "Self-sufficiency", "Financial independence", "Discipline"], reversed: ["Over-investment in work", "Superficiality", "Hustling"], keywords: "The abundant garden" },
      { upright: ["Legacy", "Inheritance", "Family", "Wealth", "Establishment"], reversed: ["Family disputes", "Financial failure", "Loss of legacy"], keywords: "The family estate" },
    ],
    court: [
      { upright: ["Ambition", "Desire to learn", "New opportunity", "Diligence"], reversed: ["Lack of progress", "Procrastination", "Missed opportunity"], keywords: "The studious apprentice" },
      { upright: ["Hard work", "Routine", "Responsibility", "Efficiency"], reversed: ["Boredom", "Stagnation", "Perfectionism", "Laziness"], keywords: "The steady worker" },
      { upright: ["Nurturing", "Practical", "Homebody", "Financial security"], reversed: ["Smothering", "Jealousy", "Insecurity"], keywords: "The garden queen" },
      { upright: ["Wealth", "Business", "Leadership", "Security", "Discipline"], reversed: ["Greed", "Indulgence", "Corruption"], keywords: "The prosperous ruler" },
    ],
  },
};

function generateMinorArcana() {
  const cards = [];
  let id = 22;
  for (const [suit, data] of Object.entries(MINOR_DATA)) {
    data.pips.forEach((pip, i) => {
      cards.push({ id: id++, name: `${PIP_NAMES[i]} of ${suit}`, suit, upright: pip.upright, reversed: pip.reversed, keywords: pip.keywords, element: MINOR_ARCANA_SUITS[suit].element, description: pip.keywords });
    });
    data.court.forEach((court, i) => {
      cards.push({ id: id++, name: `${COURT_NAMES[i]} of ${suit}`, suit, upright: court.upright, reversed: court.reversed, keywords: court.keywords, element: MINOR_ARCANA_SUITS[suit].element, description: court.keywords });
    });
  }
  return cards;
}

const ALL_MINOR = generateMinorArcana();
const ALL_CARDS = [...MAJOR_ARCANA, ...ALL_MINOR];

const CARD_SYMBOLS = {
  0: "☆", 1: "∞", 2: "☾", 3: "♀", 4: "♈", 5: "♉", 6: "♊", 7: "♋",
  8: "♌", 9: "♍", 10: "♃", 11: "♎", 12: "♆", 13: "♏", 14: "♐",
  15: "♑", 16: "♂", 17: "♒", 18: "♓", 19: "☉", 20: "♇", 21: "♄",
};

// ─── SRS HELPERS ───
function getInitialSRS() {
  return { interval: 1, ease: 2.5, nextReview: 0, streak: 0, totalCorrect: 0, totalAttempts: 0 };
}

function updateSRS(card, correct) {
  const now = Date.now();
  let { interval, ease, streak, totalCorrect, totalAttempts } = card;
  totalAttempts++;
  if (correct) {
    totalCorrect++;
    streak++;
    if (streak === 1) interval = 1;
    else if (streak === 2) interval = 3;
    else interval = Math.round(interval * ease);
    ease = Math.min(3.0, ease + 0.1);
  } else {
    streak = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  }
  return { ...card, interval, ease, streak, totalCorrect, totalAttempts, nextReview: now + interval * 60000 };
}

function getMasteryLevel(srs) {
  if (srs.totalAttempts === 0) return { level: 0, label: "Unknown", icon: "◇" };
  const ratio = srs.totalCorrect / srs.totalAttempts;
  if (ratio >= 0.9 && srs.streak >= 5) return { level: 4, label: "Mastered", icon: "◆" };
  if (ratio >= 0.75 && srs.streak >= 3) return { level: 3, label: "Confident", icon: "◈" };
  if (ratio >= 0.5) return { level: 2, label: "Learning", icon: "◇" };
  return { level: 1, label: "Struggling", icon: "○" };
}

// ─── QUIZ HELPERS ───
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(correct, pool, count = 3) {
  return shuffle(pool.filter(c => c.id !== correct.id)).slice(0, count);
}

function generateQuestion(card, pool, mode) {
  const distractors = pickDistractors(card, pool);

  if (mode === "card-to-meaning" || mode === "mixed") {
    if (mode === "mixed" && Math.random() > 0.5) {
      return generateQuestion(card, pool, Math.random() > 0.5 ? "meaning-to-card" : "upright-reversed");
    }
    const options = shuffle([
      { id: card.id, text: card.upright.slice(0, 3).join(", "), correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.upright.slice(0, 3).join(", "), correct: false })),
    ]);
    return { type: "card-to-meaning", prompt: card.name, subtitle: card.numeral || card.suit || "", card, options };
  }

  if (mode === "meaning-to-card") {
    const options = shuffle([
      { id: card.id, text: card.name, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.name, correct: false })),
    ]);
    return { type: "meaning-to-card", prompt: card.upright.slice(0, 3).join(", "), subtitle: card.keywords, card, options };
  }

  if (mode === "upright-reversed") {
    const isUpright = Math.random() > 0.5;
    const correctMeanings = isUpright ? card.upright : card.reversed;
    const wrongMeanings = isUpright ? card.reversed : card.upright;
    const options = shuffle([
      { id: "correct", text: correctMeanings.slice(0, 3).join(", "), correct: true },
      { id: "wrong", text: wrongMeanings.slice(0, 3).join(", "), correct: false },
      ...distractors.slice(0, 2).map(d => ({ id: d.id, text: (isUpright ? d.reversed : d.upright).slice(0, 3).join(", "), correct: false })),
    ]);
    return { type: "upright-reversed", prompt: `${card.name} — ${isUpright ? "Upright" : "Reversed"}`, subtitle: `What does this card mean when ${isUpright ? "upright" : "reversed"}?`, card, options };
  }

  if (mode === "spread") {
    const spreadCards = shuffle(pool).slice(0, 3);
    const positions = ["Past", "Present", "Future"];
    const scenario = spreadCards.map((c, i) => `${positions[i]}: ${c.name} (${Math.random() > 0.5 ? "Upright" : "Reversed"})`).join(" · ");
    const focusCard = spreadCards[Math.floor(Math.random() * 3)];
    const focusPos = positions[spreadCards.indexOf(focusCard)];
    const distr = pickDistractors(focusCard, pool, 3);
    const options = shuffle([
      { id: focusCard.id, text: focusCard.upright.slice(0, 2).join(", "), correct: true },
      ...distr.map(d => ({ id: d.id, text: d.upright.slice(0, 2).join(", "), correct: false })),
    ]);
    return { type: "spread", prompt: scenario, subtitle: `In the "${focusPos}" position, what does ${focusCard.name} suggest?`, card: focusCard, options };
  }

  return generateQuestion(card, pool, "card-to-meaning");
}

// ─── FIRESTORE SYNC ───
function useFirestoreSync(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const docRef = doc(db, "arcana-academy", userId);

    // Real-time listener
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setData(snap.data());
      } else {
        // Initialize
        const initial = { srsData: {}, unlockedMinor: false, bestStreak: 0, totalSessions: 0 };
        setDoc(docRef, initial);
        setData(initial);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore listener error:", err);
      // Fallback to localStorage
      try {
        const local = localStorage.getItem("arcana-academy-v2");
        if (local) setData(JSON.parse(local));
      } catch (e) {}
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  const save = useCallback(async (newData) => {
    if (!userId) return;
    try {
      const docRef = doc(db, "arcana-academy", userId);
      await setDoc(docRef, newData, { merge: true });
      // Also save locally as fallback
      localStorage.setItem("arcana-academy-v2", JSON.stringify(newData));
    } catch (err) {
      console.error("Save error:", err);
      localStorage.setItem("arcana-academy-v2", JSON.stringify(newData));
    }
  }, [userId]);

  return { data, loading, save };
}

// ─── MAIN APP ───
export default function App() {
  const [userId, setUserId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firebase anonymous auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setAuthLoading(false);
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsub();
  }, []);

  const { data: cloudData, loading: dataLoading, save } = useFirestoreSync(userId);

  const [screen, setScreen] = useState("home");
  const [srsData, setSrsData] = useState({});
  const [unlockedMinor, setUnlockedMinor] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [quizMode, setQuizMode] = useState("mixed");
  const [currentQ, setCurrentQ] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [studyCard, setStudyCard] = useState(null);
  const [showDescription, setShowDescription] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [studyFilter, setStudyFilter] = useState("major");
  const [synced, setSynced] = useState(false);

  // Load cloud data once
  useEffect(() => {
    if (cloudData && !synced) {
      setSrsData(cloudData.srsData || {});
      setUnlockedMinor(cloudData.unlockedMinor || false);
      setBestStreak(cloudData.bestStreak || 0);
      setTotalSessions(cloudData.totalSessions || 0);
      setSynced(true);
    }
  }, [cloudData, synced]);

  // Auto-save to cloud on meaningful changes (debounced)
  const saveRef = useCallback((newSrs, newUnlocked, newBest, newSessions) => {
    save({ srsData: newSrs, unlockedMinor: newUnlocked, bestStreak: newBest, totalSessions: newSessions });
  }, [save]);

  useEffect(() => {
    setAnimateIn(false);
    const t = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(t);
  }, [screen, currentQ]);

  const availableCards = useMemo(() => unlockedMinor ? ALL_CARDS : MAJOR_ARCANA, [unlockedMinor]);

  const canUnlockMinor = useMemo(() => {
    const majorMastered = MAJOR_ARCANA.filter(c => {
      const srs = srsData[c.id];
      return srs && getMasteryLevel(srs).level >= 2;
    }).length;
    return majorMastered >= 15 && !unlockedMinor;
  }, [srsData, unlockedMinor]);

  const getCardSRS = useCallback((id) => srsData[id] || getInitialSRS(), [srsData]);

  const startQuiz = useCallback((mode) => {
    setQuizMode(mode);
    const pool = [...availableCards];
    const now = Date.now();
    const due = pool.filter(c => getCardSRS(c.id).nextReview <= now);
    const sorted = due.length > 0 ? shuffle(due) : shuffle(pool);
    setSessionCorrect(0);
    setSessionTotal(0);
    setCurrentStreak(0);
    setCurrentQ(generateQuestion(sorted[0], pool, mode));
    setSelectedAnswer(null);
    setShowResult(false);
    setScreen("quiz");
  }, [availableCards, getCardSRS]);

  const handleAnswer = useCallback((option) => {
    if (showResult) return;
    setSelectedAnswer(option);
    setShowResult(true);
    const correct = option.correct;
    setSessionTotal(p => p + 1);
    if (correct) {
      setSessionCorrect(p => p + 1);
      setCurrentStreak(p => {
        const ns = p + 1;
        setBestStreak(b => {
          const newBest = Math.max(b, ns);
          return newBest;
        });
        return ns;
      });
    } else {
      setCurrentStreak(0);
    }
    setSrsData(prev => {
      const updated = { ...prev, [currentQ.card.id]: updateSRS(getCardSRS(currentQ.card.id), correct) };
      // Save to cloud after each answer
      const newBest = correct ? Math.max(bestStreak, currentStreak + 1) : bestStreak;
      saveRef(updated, unlockedMinor, newBest, totalSessions);
      return updated;
    });
  }, [showResult, currentQ, getCardSRS, bestStreak, currentStreak, unlockedMinor, totalSessions, saveRef]);

  const nextQuestion = useCallback(() => {
    const pool = availableCards;
    const now = Date.now();
    const due = pool.filter(c => getCardSRS(c.id).nextReview <= now && c.id !== currentQ?.card?.id);
    const next = due.length > 0 ? due[Math.floor(Math.random() * due.length)] : pool[Math.floor(Math.random() * pool.length)];
    setCurrentQ(generateQuestion(next, pool, quizMode));
    setSelectedAnswer(null);
    setShowResult(false);
  }, [availableCards, getCardSRS, currentQ, quizMode]);

  const endQuiz = useCallback(() => {
    const newSessions = totalSessions + 1;
    setTotalSessions(newSessions);
    saveRef(srsData, unlockedMinor, bestStreak, newSessions);
    setScreen("results");
  }, [totalSessions, srsData, unlockedMinor, bestStreak, saveRef]);

  const handleUnlockMinor = useCallback(() => {
    setUnlockedMinor(true);
    saveRef(srsData, true, bestStreak, totalSessions);
  }, [srsData, bestStreak, totalSessions, saveRef]);

  const studyCards = useMemo(() => {
    if (studyFilter === "major") return MAJOR_ARCANA;
    if (studyFilter === "wands") return ALL_MINOR.filter(c => c.suit === "Wands");
    if (studyFilter === "cups") return ALL_MINOR.filter(c => c.suit === "Cups");
    if (studyFilter === "swords") return ALL_MINOR.filter(c => c.suit === "Swords");
    if (studyFilter === "pentacles") return ALL_MINOR.filter(c => c.suit === "Pentacles");
    return availableCards;
  }, [studyFilter, availableCards]);

  const stats = useMemo(() => {
    const total = availableCards.length;
    const attempted = availableCards.filter(c => srsData[c.id]?.totalAttempts > 0).length;
    const mastered = availableCards.filter(c => srsData[c.id] && getMasteryLevel(srsData[c.id]).level >= 3).length;
    const struggling = availableCards.filter(c => srsData[c.id] && getMasteryLevel(srsData[c.id]).level === 1).length;
    return { total, attempted, mastered, struggling };
  }, [availableCards, srsData]);

  const cardFaceStyle = (card) => {
    if (card.suit === "Wands") return "#e85d26";
    if (card.suit === "Cups") return "#4a90d9";
    if (card.suit === "Swords") return "#a0aec0";
    if (card.suit === "Pentacles") return "#d4a742";
    return "#c9a84c";
  };

  // ─── LOADING SCREEN ───
  if (authLoading || dataLoading || !synced) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(170deg, #0a0a0f 0%, #121218 40%, #0d0d14 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#c9a84c",
        fontFamily: "'Cinzel', serif",
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&display=swap');
          @keyframes breathe { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        `}</style>
        <div style={{ fontSize: 48, animation: "breathe 2s ease-in-out infinite", marginBottom: 20 }}>✧</div>
        <div style={{ letterSpacing: 3, fontSize: 14, opacity: 0.6 }}>SHUFFLING THE DECK...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(170deg, #0a0a0f 0%, #121218 40%, #0d0d14 100%)",
      color: "#e8dcc8",
      fontFamily: "'Crimson Text', 'Georgia', serif",
      position: "relative",
    }}>
      {/* Particles */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            background: "radial-gradient(circle, rgba(201,168,76,0.4), transparent)",
            borderRadius: "50%",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Cinzel:wght@400;500;600;700&family=Raleway:wght@300;400;500&display=swap');
        @keyframes float { 0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; } 33% { transform: translateY(-30px) translateX(10px); opacity: 0.6; } 66% { transform: translateY(-15px) translateX(-10px); opacity: 0.2; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.3); } 50% { box-shadow: 0 0 20px 5px rgba(201,168,76,0.15); } }
        @keyframes cardReveal { from { opacity: 0; transform: rotateY(10deg) scale(0.95); } to { opacity: 1; transform: rotateY(0) scale(1); } }
        @keyframes correctPulse { 0% { box-shadow: 0 0 0 0 rgba(76,175,80,0.5); } 70% { box-shadow: 0 0 25px 10px rgba(76,175,80,0); } 100% { box-shadow: 0 0 0 0 rgba(76,175,80,0); } }
        @keyframes wrongShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        @keyframes breathe { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        .option-btn { width: 100%; padding: 14px 18px; background: rgba(201,168,76,0.06); border: 1px solid rgba(201,168,76,0.15); border-radius: 12px; color: #e8dcc8; font-family: 'Raleway', sans-serif; font-size: 14px; font-weight: 400; text-align: left; cursor: pointer; transition: all 0.25s ease; line-height: 1.5; }
        .option-btn:hover:not(:disabled) { background: rgba(201,168,76,0.12); border-color: rgba(201,168,76,0.4); transform: translateX(4px); }
        .option-btn.correct { background: rgba(76,175,80,0.15); border-color: rgba(76,175,80,0.5); animation: correctPulse 0.6s ease-out; }
        .option-btn.wrong { background: rgba(220,53,69,0.15); border-color: rgba(220,53,69,0.5); animation: wrongShake 0.4s ease; }
        .option-btn.was-correct { background: rgba(76,175,80,0.08); border-color: rgba(76,175,80,0.3); }
        .nav-btn { padding: 12px 28px; border-radius: 10px; font-family: 'Cinzel', serif; font-size: 13px; font-weight: 500; letter-spacing: 1px; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; }
        .nav-btn-primary { background: linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.1)); border: 1px solid rgba(201,168,76,0.4); color: #c9a84c; }
        .nav-btn-primary:hover { background: linear-gradient(135deg, rgba(201,168,76,0.35), rgba(201,168,76,0.15)); box-shadow: 0 4px 20px rgba(201,168,76,0.2); transform: translateY(-2px); }
        .nav-btn-ghost { background: transparent; border: 1px solid rgba(201,168,76,0.2); color: rgba(201,168,76,0.7); }
        .nav-btn-ghost:hover { border-color: rgba(201,168,76,0.4); color: #c9a84c; }
        .mode-card { padding: 20px; background: rgba(201,168,76,0.04); border: 1px solid rgba(201,168,76,0.12); border-radius: 16px; cursor: pointer; transition: all 0.3s ease; }
        .mode-card:hover { background: rgba(201,168,76,0.1); border-color: rgba(201,168,76,0.35); transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
        .study-card { padding: 14px 16px; background: rgba(201,168,76,0.04); border: 1px solid rgba(201,168,76,0.1); border-radius: 12px; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; gap: 12px; }
        .study-card:hover { background: rgba(201,168,76,0.1); border-color: rgba(201,168,76,0.3); transform: translateX(4px); }
        .filter-btn { padding: 6px 14px; border-radius: 20px; font-family: 'Raleway', sans-serif; font-size: 12px; font-weight: 400; cursor: pointer; transition: all 0.2s ease; border: 1px solid rgba(201,168,76,0.15); background: transparent; color: rgba(201,168,76,0.6); white-space: nowrap; }
        .filter-btn.active { background: rgba(201,168,76,0.15); border-color: rgba(201,168,76,0.4); color: #c9a84c; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 3px; }
        body { margin: 0; background: #0a0a0f; }
      `}</style>

      <div style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 520,
        margin: "0 auto",
        padding: "20px 16px",
        minHeight: "100vh",
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? "translateY(0)" : "translateY(15px)",
        transition: "all 0.4s ease",
      }}>

        {/* ═══ HOME ═══ */}
        {screen === "home" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 36, paddingTop: 20 }}>
              <div style={{ fontSize: 42, marginBottom: 8, filter: "drop-shadow(0 0 12px rgba(201,168,76,0.3))" }}>✧</div>
              <h1 style={{
                fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 500, letterSpacing: 3,
                background: "linear-gradient(135deg, #c9a84c, #e8dcc8, #c9a84c)", backgroundSize: "200%",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s ease-in-out infinite", marginBottom: 6,
              }}>ARCANA ACADEMY</h1>
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(201,168,76,0.5)", letterSpacing: 2, fontWeight: 300 }}>
                LEARN THE LANGUAGE OF THE CARDS
              </p>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, color: "rgba(76,175,80,0.4)", letterSpacing: 1, marginTop: 8 }}>
                ● SYNCED TO CLOUD
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
              {[
                { label: "Mastered", value: stats.mastered, icon: "◆" },
                { label: "Best Streak", value: bestStreak, icon: "🔥" },
                { label: "Sessions", value: totalSessions, icon: "✦" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", padding: "14px 8px", background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12 }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: "#c9a84c", fontWeight: 600 }}>{s.value}</div>
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, color: "rgba(201,168,76,0.5)", letterSpacing: 1, marginTop: 2 }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {canUnlockMinor && (
              <div onClick={handleUnlockMinor} style={{
                padding: "16px 20px", background: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))",
                border: "1px solid rgba(201,168,76,0.35)", borderRadius: 14, marginBottom: 24, cursor: "pointer", textAlign: "center",
                animation: "pulse 2s ease-in-out infinite",
              }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: "#c9a84c", letterSpacing: 1, marginBottom: 4 }}>✦ UNLOCK MINOR ARCANA ✦</div>
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.6)" }}>You've learned 15+ Major Arcana — tap to unlock all 78 cards</div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 2, color: "rgba(201,168,76,0.6)", marginBottom: 14, fontWeight: 500 }}>PRACTICE</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { mode: "card-to-meaning", icon: "🃏", title: "Card → Meaning", desc: "See the card, pick its keywords" },
                  { mode: "meaning-to-card", icon: "🔮", title: "Meaning → Card", desc: "Read the meaning, name the card" },
                  { mode: "upright-reversed", icon: "⚖", title: "Upright vs Reversed", desc: "Know the difference" },
                  { mode: "spread", icon: "✧", title: "Read the Spread", desc: "Interpret a mini 3-card spread" },
                  { mode: "mixed", icon: "🌙", title: "Mixed Practice", desc: "All modes, spaced repetition" },
                ].map(m => (
                  <div key={m.mode} className="mode-card" onClick={() => startQuiz(m.mode)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 24 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, color: "#e8dcc8", fontWeight: 500, marginBottom: 2 }}>{m.title}</div>
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.5)", fontWeight: 300 }}>{m.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="nav-btn nav-btn-ghost" style={{ flex: 1 }} onClick={() => setScreen("study")}>📖 Study</button>
              <button className="nav-btn nav-btn-ghost" style={{ flex: 1 }} onClick={() => setScreen("progress")}>📊 Progress</button>
            </div>
          </div>
        )}

        {/* ═══ QUIZ ═══ */}
        {screen === "quiz" && currentQ && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 16px", fontSize: 11 }} onClick={endQuiz}>✕ End</button>
              <div style={{ padding: "4px 12px", borderRadius: 20, fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 1, background: currentStreak > 0 ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.05)", color: currentStreak > 0 ? "#c9a84c" : "rgba(255,255,255,0.3)" }}>
                🔥 {currentStreak}
              </div>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.5)" }}>{sessionCorrect}/{sessionTotal}</div>
            </div>

            <div style={{
              padding: 28, background: "linear-gradient(160deg, rgba(201,168,76,0.06), rgba(201,168,76,0.02))",
              border: "1px solid rgba(201,168,76,0.15)", borderRadius: 20, marginBottom: 24, textAlign: "center",
              animation: "cardReveal 0.5s ease-out",
            }}>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, color: "rgba(201,168,76,0.4)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
                {currentQ.type === "card-to-meaning" && "What does this card mean?"}
                {currentQ.type === "meaning-to-card" && "Which card matches?"}
                {currentQ.type === "upright-reversed" && "Choose the correct meaning"}
                {currentQ.type === "spread" && "Read the spread"}
              </div>
              {currentQ.card.id < 22 && currentQ.type !== "meaning-to-card" && currentQ.type !== "spread" && (
                <div style={{ fontSize: 40, marginBottom: 8, filter: "drop-shadow(0 0 8px rgba(201,168,76,0.3))", color: "#c9a84c" }}>
                  {CARD_SYMBOLS[currentQ.card.id] || "✦"}
                </div>
              )}
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: currentQ.type === "spread" ? 14 : 22, fontWeight: 600, color: "#e8dcc8", marginBottom: 8, lineHeight: 1.5 }}>
                {currentQ.prompt}
              </div>
              {currentQ.subtitle && (
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(201,168,76,0.5)", fontStyle: "italic", fontWeight: 300 }}>
                  {currentQ.subtitle}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  className={`option-btn ${showResult ? (opt.correct ? "correct" : (selectedAnswer?.id === opt.id ? "wrong" : "")) : ""}`}
                  onClick={() => handleAnswer(opt)}
                  disabled={showResult}
                >
                  <span style={{ opacity: 0.4, marginRight: 10, fontFamily: "'Cinzel', serif", fontSize: 11 }}>{String.fromCharCode(65 + i)}</span>
                  {opt.text}
                </button>
              ))}
            </div>

            {showResult && (
              <div style={{ animation: "fadeUp 0.3s ease-out" }}>
                <div style={{
                  padding: 16, background: selectedAnswer?.correct ? "rgba(76,175,80,0.08)" : "rgba(220,53,69,0.08)",
                  border: `1px solid ${selectedAnswer?.correct ? "rgba(76,175,80,0.2)" : "rgba(220,53,69,0.2)"}`, borderRadius: 12, marginBottom: 16,
                }}>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: selectedAnswer?.correct ? "#4caf50" : "#dc3545", marginBottom: 6, fontWeight: 600 }}>
                    {selectedAnswer?.correct ? "✦ Correct!" : "✕ Not quite"}
                  </div>
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: "rgba(232,220,200,0.6)", lineHeight: 1.6, fontWeight: 300 }}>
                    <strong style={{ color: "#c9a84c" }}>{currentQ.card.name}</strong><br />
                    Upright: {currentQ.card.upright.join(", ")}<br />
                    Reversed: {currentQ.card.reversed.join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="nav-btn nav-btn-primary" style={{ flex: 1 }} onClick={nextQuestion}>Next Card →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ RESULTS ═══ */}
        {screen === "results" && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {sessionTotal === 0 ? "🌙" : sessionCorrect / sessionTotal >= 0.8 ? "✨" : sessionCorrect / sessionTotal >= 0.5 ? "🌗" : "🌑"}
            </div>
            <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: 500, letterSpacing: 2, marginBottom: 8, color: "#c9a84c" }}>Session Complete</h2>
            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 14, color: "rgba(201,168,76,0.5)", marginBottom: 32, fontWeight: 300 }}>
              {sessionTotal === 0 ? "Come back when you're ready" : `${sessionCorrect} of ${sessionTotal} correct · Best streak: ${bestStreak}`}
            </div>
            {sessionTotal > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                {[
                  { label: "Accuracy", value: `${Math.round((sessionCorrect / sessionTotal) * 100)}%` },
                  { label: "Streak", value: `🔥 ${currentStreak}` },
                ].map(s => (
                  <div key={s.label} style={{ padding: 16, background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: "#c9a84c", fontWeight: 600 }}>{s.value}</div>
                    <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, color: "rgba(201,168,76,0.5)", letterSpacing: 1, marginTop: 4 }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="nav-btn nav-btn-primary" onClick={() => startQuiz(quizMode)}>Practice Again</button>
              <button className="nav-btn nav-btn-ghost" onClick={() => setScreen("home")}>← Home</button>
            </div>
          </div>
        )}

        {/* ═══ STUDY ═══ */}
        {screen === "study" && !studyCard && (
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20, gap: 12 }}>
              <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => setScreen("home")}>← Back</button>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 500, letterSpacing: 2, color: "#c9a84c" }}>Study</h2>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { key: "major", label: "Major Arcana" },
                ...(unlockedMinor ? [
                  { key: "wands", label: "Wands" },
                  { key: "cups", label: "Cups" },
                  { key: "swords", label: "Swords" },
                  { key: "pentacles", label: "Pentacles" },
                ] : []),
              ].map(f => (
                <button key={f.key} className={`filter-btn ${studyFilter === f.key ? "active" : ""}`} onClick={() => setStudyFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {studyCards.map(card => {
                const srs = getCardSRS(card.id);
                const mastery = getMasteryLevel(srs);
                const accent = cardFaceStyle(card);
                return (
                  <div key={card.id} className="study-card" onClick={() => { setStudyCard(card); setShowDescription(false); }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: card.id < 22 ? 18 : 12, color: accent, fontFamily: "'Cinzel', serif", fontWeight: 600,
                    }}>
                      {card.id < 22 ? (CARD_SYMBOLS[card.id] || "✦") : card.name.split(" ")[0].charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 500, color: "#e8dcc8" }}>{card.name}</div>
                      <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", fontWeight: 300 }}>{card.element} · {mastery.icon} {mastery.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ STUDY DETAIL ═══ */}
        {screen === "study" && studyCard && (
          <div>
            <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px", fontSize: 11, marginBottom: 20 }} onClick={() => setStudyCard(null)}>← Back to list</button>
            <div style={{
              padding: 28, background: "linear-gradient(160deg, rgba(201,168,76,0.06), rgba(201,168,76,0.02))",
              border: "1px solid rgba(201,168,76,0.15)", borderRadius: 20, textAlign: "center", marginBottom: 24,
            }}>
              {studyCard.id < 22 && (
                <div style={{ fontSize: 48, marginBottom: 12, color: "#c9a84c", filter: "drop-shadow(0 0 12px rgba(201,168,76,0.3))" }}>
                  {CARD_SYMBOLS[studyCard.id] || "✦"}
                </div>
              )}
              <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 600, color: "#e8dcc8", marginBottom: 4 }}>{studyCard.name}</h3>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.5)", marginBottom: 16, fontWeight: 300 }}>
                {studyCard.numeral && `${studyCard.numeral} · `}{studyCard.element}
              </div>
              {studyCard.description && (
                <div onClick={() => setShowDescription(!showDescription)} style={{ padding: 14, background: "rgba(201,168,76,0.04)", borderRadius: 10, cursor: "pointer", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", letterSpacing: 1, marginBottom: 6 }}>
                    {showDescription ? "DESCRIPTION" : "TAP TO REVEAL DESCRIPTION"}
                  </div>
                  {showDescription && (
                    <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 14, color: "rgba(232,220,200,0.7)", lineHeight: 1.7, fontStyle: "italic" }}>
                      {studyCard.description}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 18, background: "rgba(76,175,80,0.04)", border: "1px solid rgba(76,175,80,0.12)", borderRadius: 14 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "rgba(76,175,80,0.6)", letterSpacing: 1, marginBottom: 10 }}>UPRIGHT</div>
                {studyCard.upright.map((m, i) => (
                  <div key={i} style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(232,220,200,0.7)", marginBottom: 6, fontWeight: 300 }}>· {m}</div>
                ))}
              </div>
              <div style={{ padding: 18, background: "rgba(220,53,69,0.04)", border: "1px solid rgba(220,53,69,0.12)", borderRadius: 14 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "rgba(220,53,69,0.6)", letterSpacing: 1, marginBottom: 10 }}>REVERSED</div>
                {studyCard.reversed.map((m, i) => (
                  <div key={i} style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: "rgba(232,220,200,0.7)", marginBottom: 6, fontWeight: 300 }}>· {m}</div>
                ))}
              </div>
            </div>
            {studyCard.keywords && (
              <div style={{ marginTop: 16, padding: 14, background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "rgba(201,168,76,0.4)", letterSpacing: 1, marginBottom: 6 }}>KEYWORDS</div>
                <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 14, color: "rgba(201,168,76,0.7)", fontStyle: "italic" }}>{studyCard.keywords}</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PROGRESS ═══ */}
        {screen === "progress" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 12 }}>
              <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => setScreen("home")}>← Back</button>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 500, letterSpacing: 2, color: "#c9a84c" }}>Progress</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Cards Seen", value: stats.attempted, total: stats.total },
                { label: "Mastered", value: stats.mastered, color: "#4caf50" },
                { label: "Struggling", value: stats.struggling, color: "#dc3545" },
                { label: "Best Streak", value: bestStreak, color: "#c9a84c" },
              ].map(s => (
                <div key={s.label} style={{ padding: 16, background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: s.color || "#c9a84c", fontWeight: 600 }}>{s.value}{s.total ? `/${s.total}` : ""}</div>
                  <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 10, color: "rgba(201,168,76,0.5)", letterSpacing: 1, marginTop: 4 }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2, color: "rgba(201,168,76,0.5)", marginBottom: 12 }}>MAJOR ARCANA MASTERY</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))", gap: 6 }}>
                {MAJOR_ARCANA.map(card => {
                  const srs = getCardSRS(card.id);
                  const mastery = getMasteryLevel(srs);
                  const colors = ["rgba(255,255,255,0.05)", "rgba(220,53,69,0.3)", "rgba(201,168,76,0.2)", "rgba(76,175,80,0.3)", "rgba(201,168,76,0.5)"];
                  return (
                    <div key={card.id} title={`${card.name} — ${mastery.label}`} style={{
                      width: "100%", aspectRatio: "1", borderRadius: 6, background: colors[mastery.level],
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                      fontFamily: "'Cinzel', serif", color: mastery.level > 0 ? "#e8dcc8" : "rgba(255,255,255,0.2)",
                      fontWeight: 600, cursor: "pointer",
                    }} onClick={() => { setStudyCard(card); setShowDescription(false); setScreen("study"); }}>
                      {card.numeral}
                    </div>
                  );
                })}
              </div>
            </div>
            {unlockedMinor && Object.keys(MINOR_ARCANA_SUITS).map(suit => (
              <div key={suit} style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2, color: MINOR_ARCANA_SUITS[suit].color, marginBottom: 10, opacity: 0.7 }}>{suit.toUpperCase()}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))", gap: 4 }}>
                  {ALL_MINOR.filter(c => c.suit === suit).map(card => {
                    const srs = getCardSRS(card.id);
                    const mastery = getMasteryLevel(srs);
                    const colors = ["rgba(255,255,255,0.05)", "rgba(220,53,69,0.3)", "rgba(201,168,76,0.2)", "rgba(76,175,80,0.3)", "rgba(201,168,76,0.5)"];
                    return <div key={card.id} title={`${card.name} — ${mastery.label}`} style={{ width: "100%", aspectRatio: "1", borderRadius: 4, background: colors[mastery.level], cursor: "pointer" }} onClick={() => { setStudyCard(card); setShowDescription(false); setScreen("study"); }} />;
                  })}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: 14, background: "rgba(201,168,76,0.04)", borderRadius: 12, border: "1px solid rgba(201,168,76,0.08)" }}>
              <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: "rgba(201,168,76,0.4)", lineHeight: 1.6, fontWeight: 300 }}>
                <span style={{ color: "rgba(220,53,69,0.5)" }}>■</span> Struggling &nbsp;
                <span style={{ color: "rgba(201,168,76,0.4)" }}>■</span> Learning &nbsp;
                <span style={{ color: "rgba(76,175,80,0.5)" }}>■</span> Confident &nbsp;
                <span style={{ color: "rgba(201,168,76,0.7)" }}>■</span> Mastered
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
