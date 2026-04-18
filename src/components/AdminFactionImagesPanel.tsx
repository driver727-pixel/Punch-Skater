import { useEffect, useRef, useState } from "react";
import { collection, deleteField, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../lib/firebase";
import { FACTION_LORE } from "../lib/lore";
import { factionSlug } from "../lib/factionSlug";

/** Resolves the original flat storage path used before faction uploads were versioned. */
function getLegacyFactionStoragePath(slug: string, ext?: string): string | null {
  return ext ? `factionImages/${slug}.${ext}` : null;
}

export function AdminFactionImagesPanel() {
  const [selectedFaction, setSelectedFaction] = useState(FACTION_LORE[0].name);
  const [factionImageFile, setFactionImageFile] = useState<File | null>(null);
  const [factionImagePreview, setFactionImagePreview] = useState<string | null>(null);
  const [factionCurrentImages, setFactionCurrentImages] = useState<Record<string, string>>({});
  const [factionCurrentExts, setFactionCurrentExts] = useState<Record<string, string>>({});
  const [factionCurrentPaths, setFactionCurrentPaths] = useState<Record<string, string>>({});
  const [factionUploadStatus, setFactionUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [factionUploadError, setFactionUploadError] = useState("");
  const [panelError, setPanelError] = useState("");
  const factionFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "factionImages"))
      .then((snap) => {
        const factionImageUrls: Record<string, string> = {};
        const factionImageExtensions: Record<string, string> = {};
        const factionStoragePaths: Record<string, string> = {};
        snap.forEach((entry) => {
          const data = entry.data();
          if (typeof data.imageUrl === "string") factionImageUrls[entry.id] = data.imageUrl;
          if (typeof data.imageExt === "string") factionImageExtensions[entry.id] = data.imageExt;
          if (typeof data.storagePath === "string") factionStoragePaths[entry.id] = data.storagePath;
        });
        setFactionCurrentImages(factionImageUrls);
        setFactionCurrentExts(factionImageExtensions);
        setFactionCurrentPaths(factionStoragePaths);
      })
      .catch((error) => {
        console.error("Failed to load faction images:", error);
        setPanelError("Failed to load faction images.");
      });
  }, []);

  const handleFactionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFactionImageFile(file);
    setFactionUploadStatus("idle");
    setFactionUploadError("");
    if (!file) {
      setFactionImagePreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => setFactionImagePreview(loadEvent.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFactionImageUpload = async () => {
    if (!factionImageFile || !storage || !db || !auth?.currentUser) return;

    setFactionUploadStatus("uploading");
    setFactionUploadError("");
    setPanelError("");

    const slug = factionSlug(selectedFaction);
    const ext = factionImageFile.name.split(".").pop()?.toLowerCase() ?? "png";
    const uploadTimestamp = Date.now();
    const storagePath = `factionImages/${slug}/${uploadTimestamp}.${ext}`;
    const previousStoragePath =
      factionCurrentPaths[slug] || getLegacyFactionStoragePath(slug, factionCurrentExts[slug]);

    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, factionImageFile, { contentType: factionImageFile.type });
      const downloadUrl = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, "factionImages", slug),
        {
          factionName: selectedFaction,
          imageExt: ext,
          imageUrl: downloadUrl,
          storagePath,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (previousStoragePath && previousStoragePath !== storagePath) {
        try {
          await deleteObject(ref(storage, previousStoragePath));
        } catch (error) {
          console.warn("Could not delete previous faction image:", error);
        }
      }

      setFactionCurrentImages((prev) => ({ ...prev, [slug]: downloadUrl }));
      setFactionCurrentExts((prev) => ({ ...prev, [slug]: ext }));
      setFactionCurrentPaths((prev) => ({ ...prev, [slug]: storagePath }));
      setFactionImageFile(null);
      setFactionImagePreview(null);
      if (factionFileInputRef.current) factionFileInputRef.current.value = "";
      setFactionUploadStatus("success");
      window.setTimeout(() => setFactionUploadStatus("idle"), 2500);
    } catch (error) {
      console.error("Faction image upload error:", error);
      setFactionUploadError("Upload failed — check your connection and try again.");
      setFactionUploadStatus("error");
    }
  };

  const handleFactionImageRemove = async (faction: string) => {
    if (!db || !auth?.currentUser) return;
    if (!window.confirm(`Remove the background image for "${faction}"?`)) return;

    const slug = factionSlug(faction);
    const storagePath = factionCurrentPaths[slug] || getLegacyFactionStoragePath(slug, factionCurrentExts[slug]);

    setPanelError("");

    try {
      await setDoc(
        doc(db, "factionImages", slug),
        {
          imageExt: deleteField(),
          imageUrl: deleteField(),
          storagePath: deleteField(),
        },
        { merge: true },
      );

      if (storage && storagePath) {
        try {
          await deleteObject(ref(storage, storagePath));
        } catch (error) {
          console.warn("Could not delete storage object:", error);
        }
      }

      setFactionCurrentImages((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setFactionCurrentExts((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setFactionCurrentPaths((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    } catch (error) {
      console.error("Faction image remove error:", error);
      setPanelError("Failed to remove faction image.");
    }
  };

  return (
    <div className="admin-create-user">
      <h2 className="admin-section-title">Faction Background Images</h2>
      <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        Upload an image to display behind a faction's description on the Factions page.
      </p>
      <div className="admin-create-form" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div className="form-group" style={{ flex: "1 1 200px", marginBottom: 0 }}>
          <select
            className="input"
            value={selectedFaction}
            onChange={(event) => setSelectedFaction(event.target.value)}
          >
            {FACTION_LORE.map((faction) => (
              <option key={faction.name} value={faction.name}>{faction.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: "2 1 240px", marginBottom: 0 }}>
          <input
            ref={factionFileInputRef}
            className="input"
            type="file"
            accept="image/*"
            onChange={handleFactionFileChange}
            style={{ cursor: "pointer" }}
          />
        </div>
        <button
          className="btn-primary"
          type="button"
          disabled={!factionImageFile || factionUploadStatus === "uploading"}
          onClick={handleFactionImageUpload}
        >
          {factionUploadStatus === "uploading" ? "⏳ Uploading…" : "Upload Image"}
        </button>
      </div>

      {factionImagePreview && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Preview:</p>
          <img
            src={factionImagePreview}
            alt="Preview"
            style={{ maxHeight: 120, borderRadius: 4, border: "1px solid var(--border)" }}
          />
        </div>
      )}

      {factionUploadStatus === "success" && (
        <p className="admin-saved" style={{ marginTop: 8 }}>✓ Image uploaded successfully.</p>
      )}
      {factionUploadStatus === "error" && (
        <p className="admin-error" style={{ marginTop: 8 }}>{factionUploadError}</p>
      )}
      {panelError && <p className="admin-error" style={{ marginTop: 8 }}>{panelError}</p>}

      {Object.keys(factionCurrentImages).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>Current faction images:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {FACTION_LORE.filter((faction) => factionCurrentImages[factionSlug(faction.name)]).map((faction) => (
              <div
                key={faction.name}
                style={{
                  position: "relative",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  overflow: "hidden",
                  width: 120,
                }}
              >
                <img
                  src={factionCurrentImages[factionSlug(faction.name)]}
                  alt={faction.name}
                  style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: "4px 6px", fontSize: 10, color: "var(--text-dim)", background: "var(--bg2)" }}>
                  {faction.name}
                </div>
                <button
                  className="btn-outline admin-delete-user-btn"
                  style={{ width: "100%", borderRadius: 0, fontSize: 11 }}
                  onClick={() => handleFactionImageRemove(faction.name)}
                >
                  🗑 Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
