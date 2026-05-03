/**
 * LanguageProfilePanel.tsx
 * ─────────────────────────
 * Compact panel rendered inside CardForge that lets paid-tier users load a
 * Craftlingua language_profile.json export and optionally apply it to card
 * generation.
 *
 * Supported input methods:
 *  - Click/drag to upload a .json file
 *  - Paste raw JSON into the textarea
 *
 * The panel is locked for Free Rider accounts — an upgrade prompt is shown
 * instead.  For paid tiers, loading a profile does NOT automatically enable it;
 * the user must explicitly toggle "Apply to card generation" on.
 */

import { useCallback, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";
import { parseCraftlinguaProfile } from "../lib/languageIngestion";
import type { CraftlinguaEnvelope } from "../lib/types";

export function LanguageProfilePanel() {
  const { profile, vocabulary, useCraftlingua, loadProfile, clearProfile, setUseCraftlingua } = useLanguage();
  const { tier, openUpgradeModal } = useTier();
  const canUseCraftlingua = TIERS[tier].canUseCraftlingua;

  const [expanded, setExpanded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parsing helpers ──────────────────────────────────────────────────────────

  const applyProfile = useCallback((raw: unknown, source: string) => {
    const parsed = parseCraftlinguaProfile(raw);
    if (!parsed) {
      setError(`${source} does not appear to be a valid Craftlingua language profile.`);
      return;
    }
    loadProfile(parsed as CraftlinguaEnvelope);
    setError("");
    setPasteText("");
    setExpanded(false);
  }, [loadProfile]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setError("Please select a .json file.");
      return;
    }
    try {
      const text = await file.text();
      applyProfile(JSON.parse(text) as unknown, "File");
    } catch {
      setError("Failed to read or parse the file.");
    }
  }, [applyProfile]);

  const handlePaste = useCallback(() => {
    try {
      applyProfile(JSON.parse(pasteText.trim()) as unknown, "JSON");
    } catch {
      setError("Invalid JSON — please check the format.");
    }
  }, [pasteText, applyProfile]);

  // ── Locked state (free tier) ─────────────────────────────────────────────────

  if (!canUseCraftlingua) {
    return (
      <div className="lang-panel lang-panel--locked">
        <div className="lang-panel-locked-row">
          <span className="lang-panel-title">🌐 CraftLingua Language Profiles</span>
          <span className="lang-panel-lock-badge">🔒 Paid</span>
        </div>
        <p className="lang-panel-locked-desc">
          Connect a{" "}
          <a href="https://craftlingua.app" target="_blank" rel="noopener noreferrer"
             aria-label="Visit Craftlingua website">
            craftlingua.app
          </a>{" "}
          language profile to generate phonetically consistent names, catchphrases and conlang lore.
          Available on Street Creator and above.
        </p>
        <button className="btn-primary btn-sm" onClick={openUpgradeModal}>
          Upgrade to Unlock
        </button>
      </div>
    );
  }

  // ── Loaded state (paid tier, profile active) ─────────────────────────────────

  if (profile && !expanded) {
    return (
      <div className="lang-panel lang-panel--loaded">
        <div className="lang-panel-top-row">
          <div className="lang-panel-info">
            <span className="lang-panel-badge">🌐</span>
            <span className="lang-panel-name">{profile.language.name}</span>
            <span className="lang-panel-code">({profile.language.code})</span>
            <span className="lang-panel-count">{vocabulary.length} words</span>
          </div>
          <div className="lang-panel-actions">
            <button className="btn-outline btn-sm" onClick={() => setExpanded(true)}>
              ↺ Change
            </button>
            <button className="btn-danger btn-sm" onClick={clearProfile}>
              ✕ Clear
            </button>
          </div>
        </div>
        {/* Explicit opt-in toggle — not mandatory */}
        <label className="lang-panel-toggle">
          <input
            type="checkbox"
            checked={useCraftlingua}
            onChange={(e) => setUseCraftlingua(e.target.checked)}
            className="lang-panel-toggle__checkbox"
          />
          <span className="lang-panel-toggle__label">
            Apply to card generation
            <span className="lang-panel-toggle__hint">
              {useCraftlingua
                ? "✓ Conlang names and lore enabled"
                : "Off — profile loaded but not applied"}
            </span>
          </span>
        </label>
      </div>
    );
  }

  // ── Load / expand state ──────────────────────────────────────────────────────

  return (
    <div className="lang-panel">
      <button type="button" className="lang-panel-header" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <span className="lang-panel-title">
          🌐 CraftLingua Profile {profile ? `— ${profile.language.name}` : "(none)"}
        </span>
        <span className="lang-panel-chevron">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="lang-panel-body">
          <p className="lang-panel-desc">
            Load a <code>language_profile.json</code> exported from{" "}
            <a href="https://craftlingua.app" target="_blank" rel="noopener noreferrer"
               aria-label="Visit Craftlingua website">
              craftlingua.app
            </a>{" "}
            to generate phonetically consistent names, catchphrases, and conlang lore.{" "}
            <a href="/language_profile_example.json" target="_blank" rel="noopener noreferrer">
              Download example ↗
            </a>
          </p>

          {/* Drop zone */}
          <div
            className={`lang-dropzone${dragging ? " lang-dropzone--active" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Drop a JSON file or click to browse"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
          >
            <span>{dragging ? "Drop to load" : "📂 Drop file or click to browse"}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
            />
          </div>

          <div className="lang-divider"><span>or paste JSON</span></div>

          <label htmlFor="lang-paste" className="visually-hidden">Paste JSON</label>
          <textarea
            id="lang-paste"
            className="lang-textarea"
            rows={5}
            placeholder={'{ "source": "craftlingua", "language": { "name": "...", "code": "..." }, "vocabulary": [...] }'}
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setError(""); }}
          />

          {error && <p className="lang-error">{error}</p>}

          <div className="lang-panel-row">
            <button
              className="btn-primary btn-sm"
              onClick={handlePaste}
              disabled={!pasteText.trim()}
            >
              Load Profile
            </button>
            {profile && (
              <button className="btn-outline btn-sm" onClick={() => setExpanded(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
