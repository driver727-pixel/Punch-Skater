import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../lib/firebase";
import {
  buildCyberJoustBodyFilename,
  buildCyberJoustBodyRecord,
  buildCyberJoustSpriteManifest,
  buildCyberJoustWeaponFilename,
  buildCyberJoustWeaponRecord,
  canvasToPngBlob,
  CYBER_JOUST_COLORS,
  CYBER_JOUST_DECKS,
  CYBER_JOUST_SPRITE_COLLECTION,
  CYBER_JOUST_STORAGE_PREFIX,
  CYBER_JOUST_WEAPONS,
  type CyberJoustBodySpriteRecord,
  type CyberJoustSpriteManifest,
  type CyberJoustWeaponSpriteRecord,
  renderCyberJoustBodySprite,
  renderCyberJoustWeaponSprite,
} from "../lib/cyberJoustSprites";

const OBJECT_URL_REVOKE_DELAY_MS = 15_000;

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
}

function buildStaticManifest(
  manifest: CyberJoustSpriteManifest,
): CyberJoustSpriteManifest {
  const stripRuntimeFields = <T extends { imageUrl?: string; storagePath?: string }>(entry: T): Omit<T, "imageUrl" | "storagePath"> => {
    const nextEntry = { ...entry };
    delete nextEntry.imageUrl;
    delete nextEntry.storagePath;
    return nextEntry;
  };

  return {
    ...manifest,
    bodies: manifest.bodies.map((entry) => stripRuntimeFields(entry)),
    weapons: manifest.weapons.map((entry) => stripRuntimeFields(entry)),
  };
}

function normalizeCollectionBodyRecord(entry: Record<string, unknown>): CyberJoustBodySpriteRecord | null {
  if (entry.kind !== "body" || typeof entry.slug !== "string" || typeof entry.deck !== "string") {
    return null;
  }
  return buildCyberJoustBodyRecord(String(entry.colorName ?? ""), entry.deck, {
    imageUrl: typeof entry.imageUrl === "string" ? entry.imageUrl : undefined,
    storagePath: typeof entry.storagePath === "string" ? entry.storagePath : undefined,
  });
}

function normalizeCollectionWeaponRecord(entry: Record<string, unknown>): CyberJoustWeaponSpriteRecord | null {
  if (entry.kind !== "weapon" || typeof entry.slug !== "string" || typeof entry.weapon !== "string") {
    return null;
  }
  return buildCyberJoustWeaponRecord(String(entry.colorName ?? ""), entry.weapon, {
    imageUrl: typeof entry.imageUrl === "string" ? entry.imageUrl : undefined,
    storagePath: typeof entry.storagePath === "string" ? entry.storagePath : undefined,
  });
}

export function AdminCyberJoustSpritesPanel() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [manifest, setManifest] = useState<CyberJoustSpriteManifest | null>(null);

  const expectedBodyCount = useMemo(
    () => CYBER_JOUST_COLORS.length * CYBER_JOUST_DECKS.length,
    [],
  );
  const expectedWeaponCount = useMemo(
    () => CYBER_JOUST_COLORS.length * CYBER_JOUST_WEAPONS.length,
    [],
  );

  const loadCollection = useCallback(async () => {
    if (!db) {
      setError("Firebase is not configured in this environment.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(collection(db, CYBER_JOUST_SPRITE_COLLECTION));
      const bodies: CyberJoustBodySpriteRecord[] = [];
      const weapons: CyberJoustWeaponSpriteRecord[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const bodyRecord = normalizeCollectionBodyRecord(data);
        if (bodyRecord) {
          bodies.push(bodyRecord);
          return;
        }
        const weaponRecord = normalizeCollectionWeaponRecord(data);
        if (weaponRecord) {
          weapons.push(weaponRecord);
        }
      });

      setManifest(buildCyberJoustSpriteManifest({ bodies, weapons }));
    } catch (loadError) {
      console.error("Failed to load Cyber Joust sprites:", loadError);
      setError("Failed to load the Cyber Joust Sprites collection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const generateAndSaveSprites = useCallback(async () => {
    if (!auth?.currentUser || !db || !storage) {
      setError("Sign in as an admin with Firebase enabled before saving Cyber Joust sprites.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("Generating body sprites…");

    const savedBodies: CyberJoustBodySpriteRecord[] = [];
    const savedWeapons: CyberJoustWeaponSpriteRecord[] = [];

    try {
      for (const color of CYBER_JOUST_COLORS) {
        for (const deck of CYBER_JOUST_DECKS) {
          const record = buildCyberJoustBodyRecord(color.name, deck);
          setStatus(`Saving ${record.label} body…`);
          const canvas = renderCyberJoustBodySprite(color.name, deck);
          const blob = await canvasToPngBlob(canvas);
          const storagePath = `${CYBER_JOUST_STORAGE_PREFIX}/${buildCyberJoustBodyFilename(record.slug)}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, blob, { contentType: "image/png" });
          const imageUrl = await getDownloadURL(storageRef);
          const savedRecord = {
            ...record,
            imageUrl,
            storagePath,
          };
          await setDoc(
            doc(db, CYBER_JOUST_SPRITE_COLLECTION, `body:${record.slug}`),
            {
              ...savedRecord,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          savedBodies.push(savedRecord);
        }
      }

      for (const color of CYBER_JOUST_COLORS) {
        for (const weapon of CYBER_JOUST_WEAPONS) {
          const record = buildCyberJoustWeaponRecord(color.name, weapon.name);
          setStatus(`Saving ${record.label} weapon…`);
          const canvas = renderCyberJoustWeaponSprite(color.name, weapon.name);
          const blob = await canvasToPngBlob(canvas);
          const storagePath = `${CYBER_JOUST_STORAGE_PREFIX}/${buildCyberJoustWeaponFilename(record.slug)}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, blob, { contentType: "image/png" });
          const imageUrl = await getDownloadURL(storageRef);
          const savedRecord = {
            ...record,
            imageUrl,
            storagePath,
          };
          await setDoc(
            doc(db, CYBER_JOUST_SPRITE_COLLECTION, `weapon:${record.slug}`),
            {
              ...savedRecord,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          savedWeapons.push(savedRecord);
        }
      }

      const nextManifest = buildCyberJoustSpriteManifest({ bodies: savedBodies, weapons: savedWeapons });
      setManifest(nextManifest);
      setStatus(`Saved ${savedBodies.length} body sprites and ${savedWeapons.length} weapon sprites.`);
    } catch (saveError) {
      console.error("Failed to save Cyber Joust sprites:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to save Cyber Joust sprites.");
    } finally {
      setSaving(false);
    }
  }, []);

  const exportSprites = useCallback(async () => {
    const activeManifest = manifest;
    if (!activeManifest) {
      setError("Save or load the Cyber Joust Sprites collection before exporting.");
      return;
    }

    setExporting(true);
    setError("");
    try {
      const staticManifest = buildStaticManifest(activeManifest);
      triggerDownload(
        new Blob([JSON.stringify(staticManifest, null, 2)], { type: "application/json" }),
        "manifest.json",
      );

      for (const entry of [...activeManifest.bodies, ...activeManifest.weapons]) {
        if (!entry.imageUrl) continue;
        setStatus(`Downloading ${entry.label}…`);
        const response = await fetch(entry.imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download ${entry.label} (HTTP ${response.status}).`);
        }
        const blob = await response.blob();
        const filename = entry.kind === "body"
          ? buildCyberJoustBodyFilename(entry.slug)
          : buildCyberJoustWeaponFilename(entry.slug);
        triggerDownload(blob, filename);
      }

      setStatus("Downloaded manifest.json and the Cyber Joust sprite PNGs.");
    } catch (exportError) {
      console.error("Failed to export Cyber Joust sprites:", exportError);
      setError(exportError instanceof Error ? exportError.message : "Failed to export Cyber Joust sprites.");
    } finally {
      setExporting(false);
    }
  }, [manifest]);

  return (
    <section className="asset-gen-section">
      <div className="adlp-section-header">
        <h2 className="asset-gen-section-title">Cyber Joust Sprites</h2>
        <button className="btn-outline" onClick={loadCollection} disabled={loading || saving || exporting}>
          {loading ? "⏳ Loading…" : "↺ Refresh"}
        </button>
      </div>

      <p className="asset-gen-toolbar-copy">
        Generate and save the Cyber Joust body and weapon sprite PNGs to the
        <code> {CYBER_JOUST_SPRITE_COLLECTION} </code>
        collection, then export the static <code>manifest.json</code> + PNG bundle for
        manual commit into <code>public/cyber-joust/assets/fighters/</code>.
      </p>

      <div className="asset-gen-toolbar" style={{ marginTop: 12 }}>
        <div className="asset-gen-counter">
          {manifest?.bodies.length ?? 0} / {expectedBodyCount} bodies · {manifest?.weapons.length ?? 0} / {expectedWeaponCount} weapons
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={generateAndSaveSprites} disabled={loading || saving || exporting}>
            {saving ? "⏳ Saving Sprites…" : "⚡ Generate + Save Collection"}
          </button>
          <button
            className="btn-outline"
            onClick={exportSprites}
            disabled={loading || saving || exporting || !manifest}
          >
            {exporting ? "⏳ Exporting…" : "⬇ Export Manifest + PNGs"}
          </button>
        </div>
      </div>

      <div className="admin-create-user" style={{ marginTop: 16 }}>
        <div className="admin-create-form" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          <div className="form-group" style={{ flex: "1 1 220px", marginBottom: 0 }}>
            <label className="label">Body Sprite Set</label>
            <div className="input" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
              {expectedBodyCount} generated from {CYBER_JOUST_COLORS.length} colors × {CYBER_JOUST_DECKS.length} decks
            </div>
          </div>
          <div className="form-group" style={{ flex: "1 1 220px", marginBottom: 0 }}>
            <label className="label">Weapon Sprite Set</label>
            <div className="input" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
              {expectedWeaponCount} generated from {CYBER_JOUST_COLORS.length} colors × {CYBER_JOUST_WEAPONS.length} weapons
            </div>
          </div>
          <div className="form-group" style={{ flex: "2 1 280px", marginBottom: 0 }}>
            <label className="label">Runtime Result</label>
            <div className="input" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
              {manifest ? `${manifest.fighters.length} runtime fighter combinations are now addressable by manifest.` : "No manifest loaded yet."}
            </div>
          </div>
        </div>
      </div>

      {status && <p className="asset-gen-toolbar-copy" style={{ marginTop: 12 }}>{status}</p>}
      {error && <p className="admin-error">{error}</p>}
    </section>
  );
}
