import { useState, useRef, useCallback } from "react";
import type { CardPayload, ImportResult } from "../lib/types";
import { validateImport, validateImportFile } from "../lib/importJson";

interface ImportModalProps {
  existingIds: Set<string>;
  onImport: (cards: CardPayload[]) => void;
  onClose: () => void;
}

type Step = "input" | "preview" | "done";

export function ImportModal({ existingIds, onImport, onClose }: ImportModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parsing helpers ────────────────────────────────────────────────────────

  const processResult = useCallback((res: ImportResult) => {
    setResult(res);
    setParseError("");
    setStep("preview");
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setParseError("Please select a .json file.");
      return;
    }
    try {
      const res = await validateImportFile(file);
      processResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to read file.");
    }
  }, [processResult]);

  const handleParse = useCallback(() => {
    try {
      const res = validateImport(pasteText.trim());
      processResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON.");
    }
  }, [pasteText, processResult]);

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Import confirm ─────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!result) return;
    setImporting(true);
    // Filter out cards that are already in the collection
    const newCards = result.accepted.filter((c) => !existingIds.has(c.id));
    onImport(newCards);
    setStep("done");
    setImporting(false);
  }, [result, existingIds, onImport]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const newCount = result
    ? result.accepted.filter((c) => !existingIds.has(c.id)).length
    : 0;
  const dupCount = result ? result.accepted.length - newCount : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel--sm import-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>✕</button>

        {step === "input" && (
          <>
            <h2 className="modal-title">IMPORT JSON</h2>
            <p className="modal-sub">
              Drop a <code>.json</code> file, click to browse, or paste JSON below.
              Accepts a Craftlingua export, a collection export, or a raw card array.
            </p>

            {/* Drop zone */}
            <div
              className={`import-dropzone${dragging ? " import-dropzone--active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <span className="import-dropzone-icon">📂</span>
              <span className="import-dropzone-label">
                {dragging ? "Drop to load" : "Drop file or click to browse"}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>

            <div className="import-divider"><span>or paste JSON</span></div>

            <textarea
              className="import-textarea"
              placeholder={`{\n  "source": "craftlingua",\n  "language": { "name": "...", "code": "..." },\n  "cards": [...]\n}`}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setParseError(""); }}
              rows={8}
            />

            {parseError && <p className="import-error">{parseError}</p>}

            <button
              className="btn-primary btn-lg"
              onClick={handleParse}
              disabled={!pasteText.trim()}
            >
              Validate JSON
            </button>
          </>
        )}

        {step === "preview" && result && (
          <>
            <h2 className="modal-title">IMPORT PREVIEW</h2>

            {result.language && (
              <div className="import-lang-badge">
                🌐 Language: <strong>{result.language.name}</strong>{" "}
                <span className="import-lang-code">({result.language.code})</span>
                {result.language.description && (
                  <p className="import-lang-desc">{result.language.description}</p>
                )}
              </div>
            )}

            <div className="import-stats">
              <div className="import-stat">
                <span className="import-stat-value import-stat-value--ok">{newCount}</span>
                <span className="import-stat-label">new cards</span>
              </div>
              {dupCount > 0 && (
                <div className="import-stat">
                  <span className="import-stat-value import-stat-value--dim">{dupCount}</span>
                  <span className="import-stat-label">already saved</span>
                </div>
              )}
              {result.vocabulary && result.vocabulary.length > 0 && (
                <div className="import-stat">
                  <span className="import-stat-value import-stat-value--purple">{result.vocabulary.length}</span>
                  <span className="import-stat-label">vocab entries</span>
                </div>
              )}
              {result.rejected.length > 0 && (
                <div className="import-stat">
                  <span className="import-stat-value import-stat-value--danger">{result.rejected.length}</span>
                  <span className="import-stat-label">invalid cards</span>
                </div>
              )}
            </div>

            {result.rejected.length > 0 && (
              <details className="import-errors-details">
                <summary>Show validation errors ({result.rejected.length})</summary>
                <ul className="import-errors-list">
                  {result.rejected.map((r) => (
                    <li key={r.index}>
                      <span className="import-error-idx">#{r.index}{r.id ? ` (${r.id})` : ""}</span>
                      <ul>
                        {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="import-preview-actions">
              <button className="btn-outline" onClick={() => { setStep("input"); setResult(null); }}>
                ← Back
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={newCount === 0 || importing}
              >
                {importing ? "Importing…" : `Import ${newCount} card${newCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <h2 className="modal-title">DONE</h2>
            <p className="modal-sub">
              {newCount} card{newCount !== 1 ? "s" : ""} added to your collection.
            </p>
            <button className="btn-primary btn-lg" onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
