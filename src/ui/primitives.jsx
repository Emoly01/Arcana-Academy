// ─── SHARED CHROME & PANEL PRIMITIVES ───
// Ornament as structure: engraved rules separate sections, gilt frames make the
// important things read as objects, and the tab bar keeps Journey / Practice /
// Progress one tap away instead of buried at the end of a long scroll.

import { useEffect, useRef, useState } from "react";
import { C, S, FONT_SERIF, FONT_SANS } from "./theme";
import { Icon, MoonIcon, EngravedRule } from "./icons";

export function SectionHead({ title, trailing }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 17, color: C.brass }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${C.ruleBright},transparent)` }} />
      {trailing}
    </div>
  );
}

export function SectionNote({ children }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, letterSpacing: ".14em", color: C.brassDim, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// 2–3px gradient-gold border so the panel reads as an object, not an outline.
export function GiltPanel({ radius = 20, pad = 2, inner, children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ position: "relative", borderRadius: radius, padding: pad, background: S.giltFrame, cursor: onClick ? "pointer" : undefined, ...style }}
    >
      <div style={{
        borderRadius: radius - pad, background: S.heroInner, position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", ...inner,
      }}>
        {children}
      </div>
    </div>
  );
}

// The one gold button — everything else is secondary by size and colour.
export function GoldButton({ children, onClick, disabled, style }) {
  return (
    <button
      className="gilt-cta"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", minHeight: 54, border: `1px solid ${C.goldPale}`, borderRadius: 14,
        background: S.ctaGold, color: "#1B1408", fontFamily: FONT_SANS, fontSize: 15, fontWeight: 600,
        letterSpacing: ".16em", textTransform: "uppercase", cursor: disabled ? "default" : "pointer",
        boxShadow: "0 6px 20px rgba(201,163,78,.22)", opacity: disabled ? 0.5 : 1,
        padding: "14px 16px", lineHeight: 1.25, ...style,
      }}
    >
      {children}
    </button>
  );
}

// Quiet row that opens a fuller view — "All six chapters", "All nine modes".
export function ChevronRow({ label, onClick, trailing }) {
  return (
    <div className="quiet-row" onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      padding: "12px 16px", borderRadius: 14, border: `1px solid ${C.rule}`,
      background: "rgba(255,255,255,.015)", cursor: "pointer",
    }}>
      <span style={{ fontFamily: FONT_SANS, fontSize: 13.5, letterSpacing: ".06em", color: C.goldDim }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {trailing}
        <Icon name="chevron" size={14} color={C.goldFaint} stroke={1.8} />
      </span>
    </div>
  );
}

// A practice mode / navigation row: circled icon, serif title, sans blurb.
export function ModeRow({ icon, title, desc, onClick, emphasis = false, trailing }) {
  return (
    <div className="mode-row" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", borderRadius: 14,
      background: emphasis ? S.panelWarm : S.panelFlat,
      border: `1px solid ${emphasis ? C.frame : C.ruleSoft}`,
      cursor: "pointer",
    }}>
      <div style={{
        flex: "0 0 auto", width: 38, height: 38, borderRadius: "50%",
        border: `1px solid ${emphasis ? C.frameWarm : C.frame}`,
        background: emphasis ? C.umberSoft : "#1A1426",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={18} color={emphasis ? C.goldBright : C.goldSoft} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: FONT_SERIF, fontSize: 19.5, lineHeight: 1.15, color: emphasis ? C.goldPale : C.goldLight }}>{title}</span>
        {desc && <span style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: emphasis ? C.textDim : C.goldDim }}>{desc}</span>}
      </div>
      {trailing}
      <Icon name="chevron" size={14} color={emphasis ? C.goldDim : C.goldGhost} stroke={1.8} />
    </div>
  );
}

// Engraved plaque: three figures separated by small gilt diamonds.
export function StatPlaque({ items }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 16px", borderRadius: 14, background: S.plaque,
      border: `1px solid ${C.ruleMid}`, boxShadow: "inset 0 1px 0 rgba(201,163,78,.12)",
    }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ display: "contents" }}>
          {i > 0 && <Icon name="spark" size={18} color={C.ruleBright} />}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_SERIF, fontSize: 24, lineHeight: 1, color: C.goldLight }}>{it.value}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: ".16em", color: C.goldDim, whiteSpace: "nowrap" }}>{it.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Six-segment chapter strip — the whole path at a glance, one row tall.
export function ProgressStrip({ segments }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {segments.map((pct, i) => (
        <div key={i} style={{
          flex: 1, height: 5, borderRadius: 3,
          background: pct >= 1 ? S.segment
            : pct <= 0 ? "#241E14"
            : `linear-gradient(90deg,${C.gold} ${Math.round(pct * 100)}%,#241E14 ${Math.round(pct * 100)}%)`,
        }} />
      ))}
    </div>
  );
}

// ─── HEADER ───
// Shrunk to a slim bar: mark, moon phase, and the signed-in witch. The name chip
// is the sign-out affordance, so the link no longer competes with the title.
export function AppHeader({ moonPhase, userName, onSignOut }) {
  const [menu, setMenu] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, [menu]);

  return (
    <div className="aa-header" style={{
      padding: "12px 18px 10px", background: S.chrome, borderBottom: `1px solid ${C.ruleGold}`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Icon name="starRing" size={22} color={C.gold} stroke={1} style={{ color: C.gold }} />
          <span style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 600, letterSpacing: ".2em", color: C.goldInk }}>ARCANA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: FONT_SANS, fontSize: 11, letterSpacing: ".1em", color: C.goldDim, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }} title={moonPhase.name}>
            <MoonIcon phase={moonPhase.name} size={12} />
            <span className="moon-label">{moonPhase.name.toUpperCase()}</span>
          </span>
          <div ref={boxRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setMenu(m => !m)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99,
                border: `1px solid ${C.ruleWarm}`, background: C.plumChip, color: C.goldDim,
                fontFamily: FONT_SANS, fontSize: 11, letterSpacing: ".1em", cursor: "pointer", maxWidth: 130,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.verdigris, flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(userName || "Witch").toUpperCase()}</span>
            </button>
            {menu && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 40, minWidth: 168,
                borderRadius: 12, padding: 6, background: S.panel, border: `1px solid ${C.frame}`,
                boxShadow: "0 18px 40px rgba(0,0,0,.6)",
              }}>
                <div style={{ padding: "6px 10px 8px", fontFamily: FONT_SANS, fontSize: 11, color: C.goldDim, letterSpacing: ".08em", borderBottom: `1px solid ${C.ruleGold}` }}>
                  Progress synced
                </div>
                <button
                  onClick={() => { setMenu(false); onSignOut(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 4,
                    padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent",
                    color: C.goldSoft, fontFamily: FONT_SANS, fontSize: 13, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <Icon name="signOut" size={15} color={C.goldSoft} stroke={1.5} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <EngravedRule />
    </div>
  );
}

// ─── TABS ───
export const TABS = [
  { key: "today", label: "TODAY", icon: "star" },
  { key: "journey", label: "JOURNEY", icon: "book" },
  { key: "practice", label: "PRACTICE", icon: "cards" },
  { key: "progress", label: "PROGRESS", icon: "bars" },
];

export function TabBar({ active, onSelect, variant = "bottom" }) {
  const rail = variant === "rail";
  return (
    <nav
      className={rail ? "aa-rail" : "aa-tabbar"}
      style={{
        background: rail ? "transparent" : S.chromeFoot,
        borderTop: rail ? "none" : `1px solid ${C.frame}`,
        padding: rail ? "8px 0" : "8px 8px calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{
        display: rail ? "flex" : "grid",
        flexDirection: rail ? "column" : undefined,
        gridTemplateColumns: rail ? undefined : "repeat(4,1fr)",
        gap: rail ? 4 : 0,
        maxWidth: rail ? undefined : 560, margin: rail ? undefined : "0 auto",
      }}>
        {TABS.map(t => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              aria-current={on ? "page" : undefined}
              style={{
                display: "flex", flexDirection: rail ? "row" : "column", alignItems: "center",
                justifyContent: rail ? "flex-start" : "center",
                gap: rail ? 12 : 5, padding: rail ? "11px 14px" : "7px 0", minHeight: 52,
                border: rail && on ? `1px solid ${C.ruleGold}` : "1px solid transparent",
                borderRadius: rail ? 12 : 0,
                background: rail && on ? S.panelFlat : "transparent",
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}
            >
              <Icon name={t.icon} size={21} color={on ? C.goldBright : C.goldFaint} stroke={1.4} />
              <span style={{
                fontFamily: FONT_SANS, fontSize: 10.5, letterSpacing: ".14em",
                color: on ? C.goldBright : C.goldFaint,
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
