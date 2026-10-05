// ─── DECKS TAB ───
// The library: Tarot (opens the original Today screen, untouched) plus every
// study deck. Sub-views — deck page, card editor, bulk import, review — are
// routed by the `view` object App keeps, so the tab bar stays live throughout.
import { useEffect, useMemo, useRef, useState } from "react";
import { C, S, FONT_SERIF, FONT_SANS } from "../ui/theme";
import { Icon } from "../ui/icons";
import { SectionHead, SectionNote, GiltPanel, GoldButton, ModeRow, StatPlaque, ChevronRow } from "../ui/primitives";
import { getMasteryLevel } from "../engine/srs";
import {
  LANGUAGES, FIELD_MAX, DECK_SOFT_LIMIT_BYTES, DECK_HARD_LIMIT_BYTES,
  deckCards, deckAllTags, parseBulkImport, makeBasicCard, validateCard, frontKey, parseTags,
  estimateBytes, newId, tagKey,
} from "./model";
import { deckCounts, NEW_PER_SESSION } from "./questions";
import {
  createDeck, updateDeckMeta, deleteDeck, saveCard, addCards, deleteCard,
} from "./store";
import BasicReview, { StudyText } from "./BasicReview";

const label = { fontFamily: FONT_SANS, fontSize: 11, letterSpacing: ".16em", color: C.goldDim, marginBottom: 6, display: "block" };
const hint = { fontFamily: FONT_SANS, fontSize: 12, color: C.textFaint, lineHeight: 1.5 };
const errText = { fontFamily: FONT_SANS, fontSize: 12.5, color: "#E8A79A", lineHeight: 1.5 };

function BackLink({ children, onClick }) {
  return (
    <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px", fontSize: 11, alignSelf: "flex-start", maxWidth: "100%" }} onClick={onClick}>
      <span className="study-text" style={{ display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>← {children}</span>
    </button>
  );
}

function Toggle({ on, onClick, children }) {
  return <button className={`filter-btn ${on ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

// Two taps to destroy anything; the second tap must come within a few seconds.
function ConfirmButton({ children, confirmText, onConfirm, style }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className="nav-btn nav-btn-ghost"
      style={{ borderColor: "rgba(220,53,69,0.4)", color: armed ? "#fff" : "#E8A79A", background: armed ? "rgba(220,53,69,0.35)" : undefined, ...style }}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}

function masteryDot(srs) {
  const level = srs ? getMasteryLevel(srs).level : 0;
  const colors = ["rgba(255,255,255,0.12)", "rgba(214,160,138,0.8)", "rgba(201,163,78,0.7)", "rgba(127,169,138,0.9)", C.goldBright];
  return <span title={srs ? getMasteryLevel(srs).label : "New"} style={{ flex: "0 0 auto", width: 9, height: 9, borderRadius: "50%", background: colors[level], marginTop: 6 }} />;
}

// ─────────────────────────── root ───────────────────────────
export default function DecksTab({
  db, uid, decks, loading, error, view, setView, tarot, onOpenTarot, onStartVoice,
}) {
  const deck = view.deckId ? decks.find((d) => d.id === view.deckId) : null;

  // A deck that was here and vanished (deleted on another device) falls back
  // to the list at once; one that hasn't arrived yet (just created, slow
  // network) gets a few seconds' grace first.
  const seenIds = useRef(new Set());
  decks.forEach((d) => seenIds.current.add(d.id));
  useEffect(() => {
    if (view.name === "list" || loading || deck) return;
    if (seenIds.current.has(view.deckId)) { setView({ name: "list" }); return; }
    const t = setTimeout(() => setView({ name: "list" }), 5000);
    return () => clearTimeout(t);
  }, [view.name, view.deckId, loading, deck, setView]);

  useEffect(() => { window.scrollTo?.(0, 0); }, [view.name, view.cardId]);

  if (view.name !== "list" && !deck) {
    return <div style={hint}>Opening the deck…</div>;
  }
  if (view.name === "list") {
    return <DeckList db={db} uid={uid} decks={decks} loading={loading} error={error} tarot={tarot}
      onOpenTarot={onOpenTarot} onOpenDeck={(id) => setView({ name: "deck", deckId: id })} />;
  }
  const toDeck = () => setView({ name: "deck", deckId: deck.id });
  if (view.name === "review") {
    return <BasicReview key={view.sessionKey} db={db} uid={uid} deck={deck} practiceAll={!!view.practiceAll} onExit={toDeck} />;
  }
  if (view.name === "card") {
    return <CardEditor key={view.cardId || `new-${view.n || 0}`} db={db} uid={uid} deck={deck} cardId={view.cardId}
      justSaved={!!view.saved} onDone={toDeck}
      onAnother={() => setView({ name: "card", deckId: deck.id, cardId: null, n: Date.now(), saved: true })} />;
  }
  if (view.name === "import") {
    return <BulkImport db={db} uid={uid} deck={deck} onDone={toDeck} />;
  }
  return <DeckDetail db={db} uid={uid} deck={deck} setView={setView} onStartVoice={onStartVoice} />;
}

// ─────────────────────────── list ───────────────────────────
function DeckList({ db, uid, decks, loading, error, tarot, onOpenTarot, onOpenDeck }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("de");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState(null);

  const summaries = useMemo(() => decks.map((d) => {
    const cards = deckCards(d);
    return { deck: d, counts: deckCounts(cards, d.srs || {}) };
  }), [decks]);
  const totalDue = tarot.due + summaries.reduce((n, s) => n + s.counts.due, 0);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true); setCreateError(null);
    try {
      const id = await createDeck(db, uid, { name: trimmed.slice(0, FIELD_MAX.deckName), language });
      setName(""); setCreating(false);
      onOpenDeck(id);
    } catch (err) {
      console.error("Create deck error:", err);
      setCreateError("Couldn't create the deck. If this keeps happening, check the Firestore rules for arcana-academy/{uid}/decks.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionHead title="Decks" trailing={totalDue > 0 ? <SectionNote>{totalDue} DUE TODAY</SectionNote> : null} />

      <ModeRow icon="cards" emphasis title="Tarot"
        desc={`${tarot.total} cards · ${tarot.due} due`} onClick={onOpenTarot} />

      {error && (
        <div style={{ ...errText, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(220,53,69,0.35)" }}>
          Your study decks couldn't be loaded ({error.code || "error"}). Tarot is unaffected.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionHead title="Study decks" trailing={<SectionNote>{decks.length}</SectionNote>} />
        {loading && <div style={hint}>Opening the satchel…</div>}
        {!loading && decks.length === 0 && !creating && (
          <div style={hint}>No study decks yet. Create one, then paste in a batch of cards.</div>
        )}
        {summaries.map(({ deck, counts }) => (
          <ModeRow key={deck.id} icon="books"
            title={<StudyText as="span" lang={deck.language} text={deck.name} style={{ whiteSpace: "normal" }} />}
            desc={`${counts.total} card${counts.total === 1 ? "" : "s"} · ${counts.due} due · ${counts.new} new`}
            onClick={() => onOpenDeck(deck.id)} />
        ))}
      </div>

      {creating ? (
        <GiltPanel inner={{ padding: "18px 18px", gap: 14 }}>
          <div>
            <label style={label} htmlFor="new-deck-name">DECK NAME</label>
            <input id="new-deck-name" className="deck-input study-text" lang={language} value={name} autoFocus
              maxLength={FIELD_MAX.deckName} placeholder="z. B. Kardiologie"
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <div>
            <span style={label}>CARD LANGUAGE</span>
            <div style={{ display: "flex", gap: 6 }}>
              {LANGUAGES.map((l) => <Toggle key={l.key} on={language === l.key} onClick={() => setLanguage(l.key)}>{l.label}</Toggle>)}
            </div>
            <div style={{ ...hint, marginTop: 6 }}>Sets hyphenation and the read-aloud voice.</div>
          </div>
          {createError && <div style={errText}>{createError}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="nav-btn nav-btn-ghost" style={{ flex: 1 }} onClick={() => { setCreating(false); setCreateError(null); }}>Cancel</button>
            <GoldButton style={{ flex: 2, minHeight: 44, width: "auto" }} disabled={!name.trim() || busy} onClick={submit}>
              {busy ? "Creating…" : "Create deck"}
            </GoldButton>
          </div>
        </GiltPanel>
      ) : (
        <ChevronRow label="+ New study deck" onClick={() => setCreating(true)} />
      )}
    </div>
  );
}

// ─────────────────────────── deck page ───────────────────────────
function DeckDetail({ db, uid, deck, setView, onStartVoice }) {
  const lang = deck.language || "de";
  const cards = useMemo(() => deckCards(deck), [deck]);
  const counts = useMemo(() => deckCounts(cards, deck.srs || {}), [cards, deck.srs]);
  const tags = useMemo(() => deckAllTags(cards), [cards]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState(null);
  const [nameDraft, setNameDraft] = useState(deck.name);
  const [settingsError, setSettingsError] = useState(null);
  useEffect(() => setNameDraft(deck.name), [deck.name]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de");
    return cards.filter((c) => {
      if (tagFilter && !(c.tags || []).some((t) => tagKey(t) === tagFilter)) return false;
      if (!q) return true;
      return [c.front, c.back, c.notes, ...(c.tags || [])].some((f) => String(f || "").toLocaleLowerCase("de").includes(q));
    });
  }, [cards, query, tagFilter]);

  const bytes = useMemo(() => estimateBytes({ cards: deck.cards, srs: deck.srs }), [deck.cards, deck.srs]);
  const newThisSitting = Math.min(counts.new, NEW_PER_SESSION);
  const canReview = counts.due + newThisSitting > 0;

  const meta = (patch) => updateDeckMeta(db, uid, deck.id, patch).catch((err) => {
    console.error(err); setSettingsError("Couldn't save the setting — check your connection.");
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <BackLink onClick={() => setView({ name: "list" })}>Decks</BackLink>

      <StudyText lang={lang} text={deck.name} style={{ fontFamily: FONT_SERIF, fontSize: 30, lineHeight: 1.15, color: C.goldPale, whiteSpace: "normal" }} />

      <StatPlaque items={[
        { value: counts.due, label: "DUE" },
        { value: counts.new, label: "NEW" },
        { value: counts.total, label: "CARDS" },
      ]} />

      {counts.total === 0 ? (
        <div style={hint}>This deck is empty. Paste in a batch with bulk import, or add cards one at a time.</div>
      ) : canReview ? (
        <GoldButton onClick={() => setView({ name: "review", deckId: deck.id, sessionKey: Date.now() })}>
          Review · {counts.due} due{newThisSitting ? ` · ${newThisSitting} new` : ""}
        </GoldButton>
      ) : (
        <GoldButton onClick={() => setView({ name: "review", deckId: deck.id, practiceAll: true, sessionKey: Date.now() })}>
          Nothing due — practise anyway
        </GoldButton>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ModeRow icon="note" title="Bulk import" desc="Paste many cards at once, preview, then save" onClick={() => setView({ name: "import", deckId: deck.id })} />
        <ModeRow icon="quill" title="Add a card" desc="Front, back, notes and tags" onClick={() => setView({ name: "card", deckId: deck.id, cardId: null })} />
        {counts.total > 0 && (
          <ModeRow icon="mic" title="Voice drill" desc={lang === "de" ? "Hands-free · read aloud in German" : "Hands-free · read aloud"} onClick={() => onStartVoice(deck.id)} />
        )}
        {counts.total > 0 && canReview && (
          <ChevronRow label="Practise every card (ignores the schedule)" onClick={() => setView({ name: "review", deckId: deck.id, practiceAll: true, sessionKey: Date.now() })} />
        )}
      </div>

      {/* Card list */}
      {counts.total > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHead title="Cards" trailing={<SectionNote>{shown.length === cards.length ? cards.length : `${shown.length} / ${cards.length}`}</SectionNote>} />
          <input className="deck-input" type="search" placeholder="Search front, back, notes, tags" value={query} lang={lang} onChange={(e) => setQuery(e.target.value)} />
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Toggle on={!tagFilter} onClick={() => setTagFilter(null)}>All</Toggle>
              {tags.map((t) => (
                <Toggle key={t.tag} on={tagFilter === tagKey(t.tag)} onClick={() => setTagFilter(tagFilter === tagKey(t.tag) ? null : tagKey(t.tag))}>
                  <span className="study-text" lang={lang}>{t.tag}</span>&nbsp;<span style={{ opacity: 0.6 }}>{t.count}</span>
                </Toggle>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {shown.map((c) => (
              <div key={c.id} className="study-card" style={{ alignItems: "flex-start" }}
                onClick={() => setView({ name: "card", deckId: deck.id, cardId: c.id })}>
                {masteryDot(deck.srs?.[c.id])}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="study-text clamp-2" lang={lang} style={{ fontFamily: FONT_SANS, fontSize: 14.5, color: C.goldLight, lineHeight: 1.4 }}>{c.front}</div>
                  <div className="study-text clamp-2" lang={lang} style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textDim, lineHeight: 1.4, marginTop: 2 }}>{c.back}</div>
                  {c.tags?.length > 0 && (
                    <div className="study-text" lang={lang} style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.goldFaint, marginTop: 4 }}>{c.tags.join(" · ")}</div>
                  )}
                </div>
              </div>
            ))}
            {shown.length === 0 && <div style={hint}>No cards match.</div>}
          </div>
        </div>
      )}

      {/* Settings */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
        <SectionHead title="Deck settings" />
        <div>
          <label style={label} htmlFor="deck-name">NAME</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="deck-name" className="deck-input study-text" lang={lang} value={nameDraft} maxLength={FIELD_MAX.deckName}
              onChange={(e) => setNameDraft(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            <button className="nav-btn nav-btn-ghost" style={{ padding: "8px 14px" }}
              disabled={!nameDraft.trim() || nameDraft.trim() === deck.name}
              onClick={() => meta({ name: nameDraft.trim() })}>Save</button>
          </div>
        </div>
        <div>
          <span style={label}>CARD LANGUAGE</span>
          <div style={{ display: "flex", gap: 6 }}>
            {LANGUAGES.map((l) => <Toggle key={l.key} on={lang === l.key} onClick={() => meta({ language: l.key })}>{l.label}</Toggle>)}
          </div>
        </div>
        <div>
          <span style={label}>QUESTION DIRECTION</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Toggle on={!deck.reverse} onClick={() => meta({ reverse: false })}>Front → back</Toggle>
            <Toggle on={!!deck.reverse} onClick={() => meta({ reverse: true })}>Both directions</Toggle>
          </div>
          <div style={{ ...hint, marginTop: 6 }}>“Both” also shows a back and asks which front it belongs to — good for term ↔ definition cards, odd for question → answer cards.</div>
        </div>
        <div style={hint}>
          Storage: {Math.round(bytes / 1024)} KB of about {Math.round(DECK_HARD_LIMIT_BYTES / 1024)} KB per deck
          {bytes > DECK_SOFT_LIMIT_BYTES && <span style={{ color: "#E8A79A" }}> — nearly full; start a second deck for new cards.</span>}
        </div>
        {settingsError && <div style={errText}>{settingsError}</div>}
        <ConfirmButton style={{ alignSelf: "flex-start" }}
          confirmText={`Tap again to delete ${counts.total} card${counts.total === 1 ? "" : "s"}`}
          onConfirm={() => deleteDeck(db, uid, deck.id).then(() => setView({ name: "list" })).catch((err) => {
            console.error(err); setSettingsError("Couldn't delete the deck.");
          })}>
          Delete deck
        </ConfirmButton>
        <div style={hint}>Deleting removes the deck and all its review history. Use “Export my data” on the Progress tab first if in doubt.</div>
      </div>
    </div>
  );
}

// ─────────────────────────── card editor ───────────────────────────
function CardEditor({ db, uid, deck, cardId, justSaved, onDone, onAnother }) {
  const lang = deck.language || "de";
  const existing = cardId ? deck.cards?.[cardId] : null;
  const [front, setFront] = useState(existing?.front || "");
  const [back, setBack] = useState(existing?.back || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [tagsText, setTagsText] = useState((existing?.tags || []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const allTags = useMemo(() => deckAllTags(deckCards(deck)), [deck]);
  const currentTags = parseTags(tagsText);
  const currentKeys = new Set(currentTags.map(tagKey));
  const duplicate = useMemo(() => {
    const k = frontKey(front);
    if (!k) return false;
    return Object.entries(deck.cards || {}).some(([id, c]) => id !== cardId && frontKey(c.front) === k);
  }, [front, deck.cards, cardId]);
  const srs = cardId ? deck.srs?.[cardId] : null;

  const save = async (another) => {
    const base = makeBasicCard({ front, back, notes, tags: tagsText }, existing?.createdAt || Date.now());
    const errors = validateCard(base);
    if (errors.length) { setError(errors.join(" · ")); return; }
    setBusy(true); setError(null);
    try {
      await saveCard(db, uid, deck.id, cardId || newId("c"), { ...base, image: existing?.image ?? null });
      if (another) onAnother(); else onDone();
    } catch (err) {
      console.error("Save card error:", err);
      setError("Couldn't save — check your connection and try again.");
      setBusy(false);
    }
  };

  const field = (id, title, value, set, opts = {}) => (
    <div>
      <label style={label} htmlFor={id}>{title}</label>
      <textarea id={id} className="type-input study-text" lang={lang} value={value} rows={opts.rows || 3}
        maxLength={opts.max} placeholder={opts.placeholder} onChange={(e) => set(e.target.value)}
        style={{ minHeight: opts.minHeight || 80, fontSize: 15 }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackLink onClick={onDone}>{deck.name}</BackLink>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 26, color: C.goldPale }}>{existing ? "Edit card" : "New card"}</div>
      {justSaved && !existing && <div style={{ ...hint, color: C.verdigris }}>Saved. Next one:</div>}

      {field("card-front", "FRONT", front, setFront, { max: FIELD_MAX.front, placeholder: "Frage oder Begriff" })}
      {duplicate && <div style={{ ...hint, color: "#E3C67F", marginTop: -8 }}>Another card in this deck has the same front.</div>}
      {field("card-back", "BACK", back, setBack, { max: FIELD_MAX.back, placeholder: "Antwort", minHeight: 100 })}
      {field("card-notes", "NOTES (OPTIONAL)", notes, setNotes, { max: FIELD_MAX.notes, placeholder: "Shown after you answer", minHeight: 70 })}

      <div>
        <label style={label} htmlFor="card-tags">TAGS (OPTIONAL, COMMA-SEPARATED)</label>
        <input id="card-tags" className="deck-input study-text" lang={lang} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="z. B. thema-a, thema-b" />
        {allTags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {allTags.filter((t) => !currentKeys.has(tagKey(t.tag))).slice(0, 16).map((t) => (
              <button key={t.tag} className="filter-btn" style={{ padding: "4px 10px", fontSize: 11.5 }}
                onClick={() => setTagsText([...currentTags, t.tag].join(", "))}>
                + <span className="study-text" lang={lang}>{t.tag}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ ...hint, marginTop: 6 }}>Cards that share a tag are used as each other’s wrong answers, so tag by topic.</div>
      </div>

      {srs && srs.totalAttempts > 0 && (
        <div style={hint}>
          {getMasteryLevel(srs).label} · {srs.totalCorrect}/{srs.totalAttempts} right · next review {new Date(srs.nextReview).toLocaleDateString("de-DE")}
          {" "}— editing keeps this history.
        </div>
      )}
      {error && <div style={errText}>{error}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!existing && (
          <button className="nav-btn nav-btn-ghost" style={{ flex: 1, minWidth: 140 }} disabled={busy} onClick={() => save(true)}>Save & add another</button>
        )}
        <GoldButton style={{ flex: 1, minWidth: 140, width: "auto", minHeight: 46 }} disabled={busy || !front.trim() || !back.trim()} onClick={() => save(false)}>
          {busy ? "Saving…" : "Save"}
        </GoldButton>
      </div>

      {existing && (
        <ConfirmButton style={{ alignSelf: "flex-start" }} confirmText="Tap again to delete"
          onConfirm={() => deleteCard(db, uid, deck.id, cardId).then(onDone).catch((err) => {
            console.error(err); setError("Couldn't delete the card.");
          })}>
          Delete card
        </ConfirmButton>
      )}
    </div>
  );
}

// ─────────────────────────── bulk import ───────────────────────────
const draftKey = (deckId) => `arcana-import-draft-${deckId}`;
function readDraft(deckId) {
  try { return localStorage.getItem(draftKey(deckId)) || ""; } catch (e) { return ""; }
}
function writeDraft(deckId, text) {
  try {
    if (text) localStorage.setItem(draftKey(deckId), text);
    else localStorage.removeItem(draftKey(deckId));
  } catch (e) { /* storage unavailable — draft just isn't kept */ }
}

function BulkImport({ db, uid, deck, onDone }) {
  const lang = deck.language || "de";
  const [text, setText] = useState(() => readDraft(deck.id));
  const [batchTags, setBatchTags] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { writeDraft(deck.id, text); }, [deck.id, text]);

  const existingFronts = useMemo(() => Object.values(deck.cards || {}).map((c) => c.front), [deck.cards]);
  const parsed = useMemo(() => parseBulkImport(text, { existingFronts, batchTags }), [text, existingFronts, batchTags]);

  const isDup = (r) => r.warnings.some((w) => /already in the deck|Same front as line/.test(w));
  const toSave = parsed.rows.filter((r) => r.ok && !(skipDuplicates && isDup(r)));
  const skippedDup = parsed.rows.filter((r) => r.ok && skipDuplicates && isDup(r)).length;

  const now = Date.now();
  const newCards = toSave.map((r, i) => ({ ...r.card, createdAt: now + i, updatedAt: now + i }));
  const projected = estimateBytes({ cards: deck.cards, srs: deck.srs }) + estimateBytes(newCards) + newCards.length * 40;
  const tooBig = projected > DECK_HARD_LIMIT_BYTES;

  const save = async () => {
    if (!newCards.length || tooBig) return;
    setBusy(true); setError(null);
    try {
      await addCards(db, uid, deck.id, newCards);
      writeDraft(deck.id, "");
      onDone();
    } catch (err) {
      console.error("Import error:", err);
      setError("Import failed — nothing after the error was saved. Check your connection and try again; already-saved cards will show as duplicates.");
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackLink onClick={onDone}>{deck.name}</BackLink>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 26, color: C.goldPale }}>Bulk import</div>

      <div style={{ padding: "14px 16px", borderRadius: 14, background: S.panelFlat, border: `1px solid ${C.ruleSoft}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ ...hint, color: C.textSoft }}>One card per line. Separate fields with a <b>tab</b> or <b>“ | ”</b> (space, pipe, space):</div>
        <code className="study-text" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: C.goldSoft, lineHeight: 1.6 }}>
          Vorderseite | Rückseite<br />
          Vorderseite | Rückseite | Notiz | tag-a, tag-b
        </code>
        <div style={hint}>Notes and tags are optional. Type <code>\n</code> for a line break inside a field. Pasting from a spreadsheet (front and back columns) works as-is.</div>
      </div>

      <textarea className="type-input study-text" lang={lang} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"Testkarte 1 | Platzhalterantwort 1\nTestkarte 2 | Platzhalterantwort 2"}
        spellCheck={false} style={{ minHeight: 200, fontSize: 14, fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 1.55 }} />

      <div>
        <label style={label} htmlFor="batch-tags">TAGS FOR THIS WHOLE BATCH (OPTIONAL)</label>
        <input id="batch-tags" className="deck-input study-text" lang={lang} value={batchTags} onChange={(e) => setBatchTags(e.target.value)} placeholder="z. B. kapitel-3" />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Toggle on={skipDuplicates} onClick={() => setSkipDuplicates(!skipDuplicates)}>
          {skipDuplicates ? "✓ " : ""}Skip duplicate fronts
        </Toggle>
      </div>

      {/* Preview */}
      {parsed.rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHead title="Preview" trailing={<SectionNote>{toSave.length} READY</SectionNote>} />
          <div style={{ ...hint, color: C.textSoft }}>
            {toSave.length} card{toSave.length === 1 ? "" : "s"} will be added
            {parsed.errorCount > 0 && <> · <span style={{ color: "#E8A79A" }}>{parsed.errorCount} line{parsed.errorCount === 1 ? "" : "s"} with errors (skipped)</span></>}
            {skippedDup > 0 && <> · {skippedDup} duplicate{skippedDup === 1 ? "" : "s"} skipped</>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {parsed.rows.map((r) => {
              const skipped = !r.ok || (skipDuplicates && isDup(r));
              const tone = !r.ok ? "rgba(220,53,69,0.45)" : r.warnings.length ? "rgba(227,198,127,0.45)" : C.ruleSoft;
              return (
                <div key={r.lineNo} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${tone}`, background: S.panelFlat, opacity: skipped ? 0.6 : 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ flex: "0 0 auto", fontFamily: FONT_SANS, fontSize: 11, color: C.goldFaint, minWidth: 22, marginTop: 2 }}>{r.lineNo}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {r.ok || r.card.front ? (
                        <>
                          <StudyText lang={lang} text={r.card.front || "—"} style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.goldLight, lineHeight: 1.4 }} />
                          <StudyText lang={lang} text={r.card.back || "—"} style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textDim, lineHeight: 1.45, marginTop: 3 }} />
                          {r.card.notes && <StudyText lang={lang} text={`Notiz: ${r.card.notes}`} style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textFaint, marginTop: 3, fontStyle: "italic" }} />}
                          {r.card.tags.length > 0 && <div className="study-text" lang={lang} style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.goldFaint, marginTop: 4 }}>{r.card.tags.join(" · ")}</div>}
                        </>
                      ) : (
                        <StudyText lang={lang} text={r.raw} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: C.textDim }} />
                      )}
                      {r.errors.map((e) => <div key={e} style={{ ...errText, fontSize: 12, marginTop: 4 }}>✗ {e}</div>)}
                      {r.warnings.map((w) => <div key={w} style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#E3C67F", marginTop: 4 }}>⚠ {w}{skipDuplicates && isDup(r) ? " — skipped" : ""}</div>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tooBig && <div style={errText}>This batch would push the deck past Firestore’s 1 MB document limit. Split it, or put these cards in a new deck.</div>}
      {!tooBig && projected > DECK_SOFT_LIMIT_BYTES && <div style={{ ...hint, color: "#E3C67F" }}>After this import the deck will be close to its size limit (~{Math.round(projected / 1024)} KB of 1000 KB).</div>}
      {error && <div style={errText}>{error}</div>}

      <GoldButton disabled={busy || !newCards.length || tooBig} onClick={save}>
        {busy ? "Saving…" : newCards.length ? `Add ${newCards.length} card${newCards.length === 1 ? "" : "s"}` : "Nothing to add yet"}
      </GoldButton>
      {text && (
        <button className="nav-btn nav-btn-ghost" style={{ alignSelf: "center", padding: "8px 16px", fontSize: 11 }} onClick={() => setText("")}>Clear text</button>
      )}
    </div>
  );
}
