// ─── ILLUMINATED GRIMOIRE — design tokens ───
// Palette from the "Arcana Redesign v2" handoff: aubergine-into-ink grounds,
// gilt frames rather than hairlines, engraved rules, oxblood seals.

export const C = {
  // grounds
  ink:        "#07060A",
  inkDeep:    "#0A0810",
  inkPanel:   "#0D0B12",
  inkSoft:    "#0E0B14",
  plum:       "#171226",
  plumSoft:   "#161122",
  plumDim:    "#141020",
  plumChip:   "#120F19",
  umber:      "#221A12",
  umberSoft:  "#241B12",

  // frames & rules
  rule:       "#241E14",
  ruleSoft:   "#262013",
  ruleMid:    "#2A2318",
  ruleWarm:   "#2E2618",
  ruleGold:   "#33291A",
  ruleBright: "#3A2F1C",
  frame:      "#4A3A1C",
  frameMid:   "#5A4620",
  frameWarm:  "#7A5F2C",
  frameHot:   "#8A6F36",

  // gilt
  gold:       "#C9A34E",
  goldBright: "#E3C67F",
  goldPale:   "#F4E7C4",
  goldLight:  "#EFDFB2",
  goldInk:    "#EBD7A4",
  goldSoft:   "#D6BE86",
  goldDim:    "#8A7A56",
  goldFaint:  "#6B5A34",
  goldGhost:  "#5A4A2A",
  brass:      "#B99F6C",
  brassDim:   "#9A8558",

  // text
  text:       "#EDE7DA",
  textSoft:   "#B4A88C",
  textDim:    "#A3987F",
  textFaint:  "#948C77",

  // seals & accents
  sealUpBg:   "#2E1A1A",
  sealUpLine: "#5A2A2A",
  sealUpText: "#D6A08A",
  sealRevBg:  "#1B1A2E",
  sealRevLine:"#3A3560",
  sealRevText:"#ADA6D0",
  verdigris:  "#7FA98A",
};

// Panel / frame recipes reused across the redesigned screens.
export const S = {
  giltFrame:   `linear-gradient(150deg,${C.frameWarm},#2A2116 45%,${C.frameHot})`,
  heroInner:   `radial-gradient(120% 90% at 50% 0%, ${C.umberSoft} 0%, #14101A 70%)`,
  panel:       `linear-gradient(160deg,${C.plum} 0%,${C.inkSoft} 100%)`,
  panelFlat:   `linear-gradient(180deg,${C.plumDim} 0%,${C.inkSoft} 100%)`,
  panelWarm:   `linear-gradient(180deg,${C.umber} 0%,#120F18 100%)`,
  plaque:      `linear-gradient(180deg,${C.plumSoft} 0%,${C.inkSoft} 100%)`,
  chapter:     `linear-gradient(155deg,#1C1428 0%,${C.inkSoft} 100%)`,
  chrome:      `linear-gradient(180deg,${C.plum} 0%,${C.inkPanel} 100%)`,
  chromeFoot:  `linear-gradient(180deg,${C.plum} 0%,${C.inkDeep} 100%)`,
  cardMat:     `linear-gradient(150deg,${C.gold},${C.frame} 50%,${C.gold})`,
  ctaGold:     `linear-gradient(180deg,${C.goldBright} 0%,#C29B47 100%)`,
  ctaGoldHot:  `linear-gradient(180deg,#F0D79A 0%,#D0A954 100%)`,
  segment:     `linear-gradient(90deg,${C.gold},${C.frameHot})`,
};

export const FONT_SERIF = "'Cormorant Garamond', 'Georgia', serif";
export const FONT_SANS = "'Source Sans 3', system-ui, sans-serif";

const ROMAN = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

// Roman numerals carry the engraved look; 0 has no numeral, so it reads as a rule.
export function roman(n) {
  let v = Math.floor(Number(n) || 0);
  if (v <= 0) return "—";
  if (v > 3999) return String(v);
  let out = "";
  for (const [value, sym] of ROMAN) {
    while (v >= value) { out += sym; v -= value; }
  }
  return out;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve"];

// Prose numbers are spelled out up to twelve, as in the mock ("About six minutes").
export function spell(n) {
  const v = Math.round(Number(n) || 0);
  return v >= 0 && v < WORDS.length ? WORDS[v] : String(v);
}
