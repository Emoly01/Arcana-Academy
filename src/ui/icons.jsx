// ─── DRAWN ICON SET ───
// A single thin-line gilt set replacing the emoji: the emoji were the loudest
// colour on screen and fought the engraved, occult mood. Every glyph lives on a
// 24×24 grid so sizes stay optically even at 12–24px.

import { C } from "./theme";

const REG = {
  // ── navigation & chrome ──
  star: () => (
    <path d="M12 2.6l2.3 7.1h7.4l-6 4.3 2.3 7.1-6-4.4-6 4.4 2.3-7.1-6-4.3h7.4z" fill="currentColor" stroke="none" />
  ),
  starRing: () => (
    <>
      <circle cx="12" cy="12" r="10.4" fill="none" />
      <path d="M12 2.6l2.3 7.1h7.4l-6 4.3 2.3 7.1-6-4.4-6 4.4 2.3-7.1-6-4.3h7.4z" fill="currentColor" stroke="none" />
    </>
  ),
  book: () => (
    <>
      <path d="M4 5.5A2.5 2.5 0 016.5 3H19v16H6.5A2.5 2.5 0 004 21.5z" />
      <path d="M9 8h6" />
    </>
  ),
  bookOpen: () => (
    <>
      <path d="M12 6.5C10.5 5 8.4 4.4 4 4.5v13c4.4-.1 6.5.5 8 2 1.5-1.5 3.6-2.1 8-2v-13c-4.4-.1-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  cards: () => (
    <>
      <rect x="3" y="4" width="11" height="15" rx="2" />
      <path d="M10 6l7 2-3 12-6-2" />
    </>
  ),
  bars: () => <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,

  // ── arrows & marks ──
  chevron: () => <path d="M9 6l6 6-6 6" />,
  arrowRight: () => <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: () => <path d="M12 20V5M6 11l6-6 6 6" />,
  arrowDown: () => <path d="M12 4v15M18 13l-6 6-6-6" />,
  check: () => <path d="M4 12.5l5.5 5.5L20 7" />,
  lock: () => (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 017 0V10" />
    </>
  ),
  key: () => (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l8 8M16 16l2.5-2.5M19 19l2-2" />
    </>
  ),
  diamond: () => <path d="M12 3l6 9-6 9-6-9z" fill="currentColor" stroke="none" />,
  spark: () => <path d="M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" stroke="none" />,
  signOut: () => (
    <>
      <path d="M10 20H6a2 2 0 01-2-2V6a2 2 0 012-2h4" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),

  // ── practice modes ──
  cardFace: () => (
    <>
      <rect x="4" y="3" width="11" height="16" rx="2" />
      <path d="M8 21h12V7" />
    </>
  ),
  orb: () => (
    <>
      <circle cx="12" cy="10" r="6.5" />
      <path d="M6 19h12M9.5 8.2a3.2 3.2 0 012.6-2.1" />
      <path d="M8 16.5h8l-.7 2.5H8.7z" />
    </>
  ),
  frame: () => (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 16l5-4.5 4 3.5 3.5-3L21 16" />
      <circle cx="8.5" cy="9" r="1.3" />
    </>
  ),
  temple: () => (
    <>
      <path d="M4 19h16M8 19V9l4-5 4 5v10" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  scales: () => (
    <>
      <path d="M12 4v16M7 20h10M5 9h14" />
      <path d="M5 9l-2.5 5a2.5 2.5 0 005 0zM19 9l-2.5 5a2.5 2.5 0 005 0z" />
    </>
  ),
  quill: () => (
    <>
      <path d="M20 3c-8 .8-13 4.3-14.6 9.4L4.2 17 9 15.6C14.4 14.2 18.3 10.4 20 3z" />
      <path d="M17 6.2C13 8.6 9.6 12.2 7.4 16.4M3 21l3-3.6" />
    </>
  ),
  puzzle: () => (
    <path d="M10 4h4v2.2a1.8 1.8 0 103.5 0V4H20v4.5h-2.2a1.8 1.8 0 100 3.5H20V20h-4.5v-2.2a1.8 1.8 0 10-3.5 0V20H4v-4.5h2.2a1.8 1.8 0 100-3.5H4V8h6z" />
  ),
  pawn: () => (
    <>
      <circle cx="12" cy="6.5" r="2.8" />
      <path d="M9.4 9.2c-.4 2.4-1.4 3.6-2.4 4.6h10c-1-1-2-2.2-2.4-4.6" />
      <path d="M6 20h12M8 13.8c0 3-.6 4.9-1.4 6.2M16 13.8c0 3 .6 4.9 1.4 6.2" />
    </>
  ),
  crescent: () => <path d="M15.8 3.6a8.6 8.6 0 100 16.8 7.2 8.6 0 010-16.8z" />,
  mic: () => (
    <>
      <path d="M9 6a3 3 0 016 0v4a3 3 0 01-6 0z" />
      <path d="M6 11a6 6 0 0012 0M12 17v4" />
    </>
  ),
  search: () => (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3L21 21" />
    </>
  ),

  // ── status ──
  hourglass: () => (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />
    </>
  ),
  flame: () => (
    <path d="M12 21a6.2 6.2 0 006.2-6.2c0-4.2-3.1-6.7-4.7-9.8-.6 2.1-1.6 3.2-2.7 4.2-.6-.8-1-1.7-1-2.7-1.6 2.2-4 4.6-4 8.3A6.2 6.2 0 0012 21z" />
  ),
  alembic: () => (
    <>
      <path d="M10 3h4M11 3v5.5L6.5 17a3 3 0 002.7 4h5.6a3 3 0 002.7-4L13 8.5V3" />
      <path d="M8.2 14h7.6" />
    </>
  ),
  eye: () => (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  sun: () => (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
    </>
  ),
  droplet: () => <path d="M12 3.5c3.6 3.8 5.5 6.6 5.5 9.3a5.5 5.5 0 01-11 0c0-2.7 1.9-5.5 5.5-9.3z" />,
  wind: () => (
    <path d="M3 8h9.5a2.75 2.75 0 10-2.7-3.3M3 12h13.5a2.75 2.75 0 11-2.7 3.3M3 16h7" />
  ),
  coin: () => (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 5.4l4.1 12.5-10.6-7.7h13L7.9 17.9z" />
    </>
  ),
  seedling: () => (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c0-3-2.2-5.2-5.2-5.2C6.8 11.8 9 14 12 14zM12 14c0-3.4 2.5-5.9 5.9-5.9C17.9 11.5 15.4 14 12 14z" />
    </>
  ),
  comet: () => (
    <>
      <path d="M15.5 4.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
      <path d="M11.5 12.5L3 21M9 13.5l-3 3M13.5 16l-3 3" />
    </>
  ),
  note: () => (
    <>
      <path d="M5 4.5A1.5 1.5 0 016.5 3H14l5 5v11.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19.5z" />
      <path d="M13.5 3v5.5H19M8.5 13h7M8.5 16.5h4.5" />
    </>
  ),
  books: () => (
    <>
      <path d="M4 5.2A1.2 1.2 0 015.2 4H8v16H5.2A1.2 1.2 0 014 18.8zM10 4h2.8A1.2 1.2 0 0114 5.2v13.6a1.2 1.2 0 01-1.2 1.2H10z" />
      <path d="M16.2 5.6l2.6-.6 2 14-2.6.6z" />
    </>
  ),
  globe: () => (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2M12 3.4c2.3 2.4 3.4 5.3 3.4 8.6S14.3 18.2 12 20.6c-2.3-2.4-3.4-5.3-3.4-8.6S9.7 5.8 12 3.4z" />
    </>
  ),

  // ── the Fool's Journey chapters ──
  sunrise: () => (
    <>
      <path d="M3 19h18M6.5 19a5.5 5.5 0 0111 0" />
      <path d="M12 4.5v3M4.8 8.3l2 2M19.2 8.3l-2 2" />
    </>
  ),
  pillars: () => (
    <>
      <path d="M3 7.5L12 3l9 4.5M3.5 20.5h17" />
      <path d="M6.5 9.5v9M11 9.5v9M15.5 9.5v9M20 9.5v9" />
    </>
  ),
  lantern: () => (
    <>
      <path d="M9 3h6M10 6h4M8 9.5A4 4 0 0112 6a4 4 0 014 3.5v6A2.5 2.5 0 0113.5 18h-3A2.5 2.5 0 018 15.5z" />
      <path d="M12 21v-3" />
    </>
  ),
  darkMoon: () => (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 3.6a8.4 8.4 0 000 16.8 6 8.4 0 000-16.8z" fill="currentColor" stroke="none" />
    </>
  ),
  stars: () => (
    <>
      <path d="M8 3l1.5 4.3L14 8.8l-4.5 1.5L8 14.6l-1.5-4.3L2 8.8l4.5-1.5z" fill="currentColor" stroke="none" />
      <path d="M17 12l1 2.9 3 1-3 1-1 2.9-1-2.9-3-1 3-1z" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({
  name, size = 20, color = C.goldSoft, stroke = 1.35, style, title,
}) {
  const draw = REG[name];
  if (!draw) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ color, display: "block", flexShrink: 0, ...style }}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {draw()}
    </svg>
  );
}

// The moon disc is drawn rather than picked from emoji so the header keeps the
// same gilt line weight as everything around it.
export function MoonIcon({ phase = "Full Moon", size = 13, color = C.gold, style }) {
  const r = 9;
  // Lit-limb geometry: outer semicircle + an inner ellipse whose sweep decides
  // whether the terminator bulges toward the limb (gibbous) or away (crescent).
  const half = (right) => `M12 ${12 - r} A${r} ${r} 0 0 ${right ? 1 : 0} 12 ${12 + r} Z`;
  const lens = (right, k, gibbous) =>
    `M12 ${12 - r} A${r} ${r} 0 0 ${right ? 1 : 0} 12 ${12 + r} A${k} ${r} 0 0 ${gibbous === right ? 1 : 0} 12 ${12 - r} Z`;

  let lit = null;
  switch (phase) {
    case "New Moon": lit = null; break;
    case "Waxing Crescent": lit = lens(true, 5.2, false); break;
    case "First Quarter": lit = half(true); break;
    case "Waxing Gibbous": lit = lens(true, 5.2, true); break;
    case "Full Moon": lit = "full"; break;
    case "Waning Gibbous": lit = lens(false, 5.2, true); break;
    case "Last Quarter": lit = half(false); break;
    default: lit = lens(false, 5.2, false); break; // Waning Crescent
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0, ...style }} aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill={C.umberSoft} stroke={color} strokeWidth="1" strokeOpacity="0.55" />
      {lit === "full" && <circle cx="12" cy="12" r={r} fill={color} />}
      {lit && lit !== "full" && <path d={lit} fill={color} />}
    </svg>
  );
}

// Engraved rule with a diamond centrepiece — decoration doing the spacing work.
export function EngravedRule({ width = "100%", tone = C.ruleGold, jewel = C.frameHot, height = 7 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 356 7" preserveAspectRatio="none" style={{ display: "block" }} aria-hidden="true">
      <path d="M0 3.5h150M206 3.5h150" stroke={tone} strokeWidth="1" />
      <path d="M178 0l4 3.5-4 3.5-4-3.5z" fill={jewel} />
      <path d="M162 3.5h8M186 3.5h8" stroke={tone} strokeWidth="1" />
    </svg>
  );
}

// Filigree finial that closes a scroll.
export function Finial() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
      <svg width="120" height="12" viewBox="0 0 120 12" aria-hidden="true">
        <path d="M4 6h38M78 6h38" stroke={C.rule} strokeWidth="1" />
        <path d="M60 1l3.4 5-3.4 5-3.4-5z" fill={C.ruleBright} />
        <circle cx="49" cy="6" r="1.6" fill={C.ruleWarm} />
        <circle cx="71" cy="6" r="1.6" fill={C.ruleWarm} />
      </svg>
    </div>
  );
}

// Corner flourish for gilt-framed panels (mirrored via scaleX for the right side).
export function CornerFlourish({ side = "left", size = 46 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 46 46" aria-hidden="true"
      style={{
        position: "absolute", top: 0, [side]: 0, opacity: 0.55, pointerEvents: "none",
        transform: side === "right" ? "scaleX(-1)" : "none",
      }}
    >
      <path d="M2 20V6a4 4 0 014-4h14" fill="none" stroke={C.gold} strokeWidth="1" />
      <path d="M8 8c6 0 10 4 10 10" fill="none" stroke={C.frameWarm} strokeWidth="1" />
    </svg>
  );
}
