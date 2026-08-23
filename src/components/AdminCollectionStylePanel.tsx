import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveCollectionStyleBatch,
  createCollectionStyleBatch,
  generateNextCollectionStyleCard,
  getCollectionStyleBatch,
  getCollectionStyleOverview,
  getCollectionStyleSourceAssets,
  getCollectionStyleTrainingJob,
  startCollectionStyleTraining,
  type CollectionStyleBatch,
  type CollectionStyleBatchItem,
  type CollectionStyleProfile,
  type CollectionStyleSourceAsset,
  type CollectionStyleTrainingJob,
} from "../services/collectionStyle";

const MIN_SOURCE_COUNT = 12;

function formatProfile(profile: CollectionStyleProfile | null): string {
  if (!profile?.loraUrl) return "No trained collection style is active.";
  return `Ready · ${profile.version || "unversioned"} · token “${profile.triggerToken || "collection style"}”`;
}

function statusLabel(status: string): string {
  return status.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function AdminCollectionStylePanel() {
  const [profile, setProfile] = useState<CollectionStyleProfile | null>(null);
  const [trainingJobs, setTrainingJobs] = useState<CollectionStyleTrainingJob[]>([]);
  const [sourceAssets, setSourceAssets] = useState<CollectionStyleSourceAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [triggerToken, setTriggerToken] = useState("punchskater_collection_style");
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [characterLayersConfirmed, setCharacterLayersConfirmed] = useState(false);
  const [activeBatch, setActiveBatch] = useState<CollectionStyleBatch | null>(null);
  const [batchItems, setBatchItems] = useState<CollectionStyleBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const latestTrainingJob = trainingJobs[0] ?? null;
  const eligibleAssets = useMemo(
    () => sourceAssets.filter((asset) => asset.eligible),
    [sourceAssets],
  );
  const completedApproval = activeBatch?.progress?.approvalCompleted ?? 0;
  const approvalCount = activeBatch?.progress?.approvalCount ?? activeBatch?.approvalCount ?? 0;

  const loadBatch = useCallback(async (batchId: string) => {
    const data = await getCollectionStyleBatch(batchId);
    setActiveBatch(data.batch);
    setBatchItems(data.items);
  }, []);

  const loadWorkspace = useCallback(async (pollTraining = false) => {
    setLoading(true);
    setError("");
    try {
      let overview = await getCollectionStyleOverview();
      const trainingJob = overview.trainingJobs[0];
      if (pollTraining && trainingJob?.status === "training") {
        await getCollectionStyleTrainingJob(trainingJob.id);
        overview = await getCollectionStyleOverview();
      }
      const sources = await getCollectionStyleSourceAssets();
      setProfile(overview.profile);
      setTrainingJobs(overview.trainingJobs);
      setSourceAssets(sources.assets);
      setSelectedIds((previous) => new Set(
        [...previous].filter((id) => sources.assets.some((asset) => asset.id === id && asset.eligible)),
      ));
      const batchId = activeBatch?.id ?? overview.batches[0]?.id;
      if (batchId) {
        await loadBatch(batchId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load collection-style workflow.");
    } finally {
      setLoading(false);
    }
  }, [activeBatch?.id, loadBatch]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const toggleSource = useCallback((assetId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const selectEligibleSources = useCallback(() => {
    setSelectedIds(new Set(eligibleAssets.map((asset) => asset.id)));
  }, [eligibleAssets]);

  const startTraining = useCallback(async () => {
    setAction("training");
    setError("");
    try {
      const result = await startCollectionStyleTraining({
        sourceCardIds: [...selectedIds],
        triggerToken,
        ownershipConfirmed,
        characterLayersConfirmed,
      });
      await getCollectionStyleTrainingJob(result.jobId);
      await loadWorkspace();
    } catch (trainingError) {
      setError(trainingError instanceof Error ? trainingError.message : "Failed to start collection-style training.");
    } finally {
      setAction(null);
    }
  }, [
    characterLayersConfirmed,
    loadWorkspace,
    ownershipConfirmed,
    selectedIds,
    triggerToken,
  ]);

  const refreshTraining = useCallback(async () => {
    if (!latestTrainingJob) return;
    setAction("refresh-training");
    setError("");
    try {
      await getCollectionStyleTrainingJob(latestTrainingJob.id);
      await loadWorkspace();
    } catch (trainingError) {
      setError(trainingError instanceof Error ? trainingError.message : "Failed to refresh LoRA training.");
    } finally {
      setAction(null);
    }
  }, [latestTrainingJob, loadWorkspace]);

  const createBatch = useCallback(async () => {
    setAction("create-batch");
    setError("");
    try {
      const result = await createCollectionStyleBatch();
      await loadBatch(result.batch.id);
      await loadWorkspace();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "Failed to create the 64-card batch.");
    } finally {
      setAction(null);
    }
  }, [loadBatch, loadWorkspace]);

  const generateNext = useCallback(async (retryFailed = false) => {
    if (!activeBatch) return;
    setAction(retryFailed ? "retry" : "generate");
    setError("");
    try {
      await generateNextCollectionStyleCard(activeBatch.id, retryFailed);
      await loadBatch(activeBatch.id);
      await loadWorkspace();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Failed to generate the next character layer.");
      await loadBatch(activeBatch.id).catch(() => {});
    } finally {
      setAction(null);
    }
  }, [activeBatch, loadBatch, loadWorkspace]);

  const approveBatch = useCallback(async () => {
    if (!activeBatch) return;
    setAction("approve");
    setError("");
    try {
      await approveCollectionStyleBatch(activeBatch.id);
      await loadBatch(activeBatch.id);
      await loadWorkspace();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Failed to release the remaining collection.");
    } finally {
      setAction(null);
    }
  }, [activeBatch, loadBatch, loadWorkspace]);

  const canStartTraining = selectedIds.size >= MIN_SOURCE_COUNT
    && ownershipConfirmed
    && characterLayersConfirmed
    && triggerToken.trim().length >= 3
    && action == null;
  const completedItems = batchItems.filter((item) => item.status === "completed");
  const failedItems = batchItems.filter((item) => item.status === "failed");

  return (
    <div className="collection-style-panel">
      <section className="asset-gen-section">
        <div className="collection-style-panel__header">
          <div>
            <h2 className="asset-gen-section-title">Collection Style LoRA</h2>
            <p className="asset-gen-toolbar-copy">
              Train only on owned, high-quality <strong>character layers</strong>. Backgrounds, frames,
              boards, weapons, and card screenshots are excluded from this workflow.
            </p>
          </div>
          <button className="btn-outline" onClick={() => void loadWorkspace(true)} disabled={loading || action !== null}>
            {loading ? "⏳ Loading…" : "↺ Refresh"}
          </button>
        </div>

        <div className={`collection-style-profile${profile?.loraUrl ? " collection-style-profile--ready" : ""}`}>
          <strong>Collection profile:</strong> {formatProfile(profile)}
        </div>

        {error && <p className="admin-error">{error}</p>}
      </section>

      <section className="asset-gen-section">
        <div className="collection-style-panel__header">
          <div>
            <h2 className="asset-gen-section-title">1. Curate character-layer sources</h2>
            <p className="asset-gen-toolbar-copy">
              Choose at least {MIN_SOURCE_COUNT} eligible Boss Assets across multiple archetypes, districts, and styles.
              The server creates captions with the style token and each card&apos;s character attributes.
            </p>
          </div>
          <button className="btn-outline" onClick={selectEligibleSources} disabled={action !== null || eligibleAssets.length === 0}>
            Select eligible ({eligibleAssets.length})
          </button>
        </div>

        <label className="collection-style-token">
          <span>Unique style token</span>
          <input
            type="text"
            value={triggerToken}
            onChange={(event) => setTriggerToken(event.target.value.toLowerCase())}
            maxLength={48}
            pattern="[a-z][a-z0-9_-]{2,47}"
            disabled={action !== null}
          />
        </label>

        <div className="collection-style-confirmations">
          <label>
            <input
              type="checkbox"
              checked={ownershipConfirmed}
              onChange={(event) => setOwnershipConfirmed(event.target.checked)}
              disabled={action !== null}
            />
            I confirm these sources are owned or licensed for this training use.
          </label>
          <label>
            <input
              type="checkbox"
              checked={characterLayersConfirmed}
              onChange={(event) => setCharacterLayersConfirmed(event.target.checked)}
              disabled={action !== null}
            />
            I confirm every source is character-layer art, not a complete card or scene.
          </label>
        </div>

        <p className="collection-style-selection-count">
          {selectedIds.size} selected / {MIN_SOURCE_COUNT} minimum
        </p>

        {sourceAssets.length === 0 && !loading ? (
          <p className="adlp-empty">No Boss Assets are available yet.</p>
        ) : (
          <div className="collection-style-source-grid">
            {sourceAssets.map((asset) => (
              <label
                key={asset.id}
                className={`collection-style-source${selectedIds.has(asset.id) ? " collection-style-source--selected" : ""}${asset.eligible ? "" : " collection-style-source--ineligible"}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.id)}
                  onChange={() => toggleSource(asset.id)}
                  disabled={!asset.eligible || action !== null}
                />
                {asset.characterImageUrl ? (
                  <img src={asset.characterImageUrl} alt="" />
                ) : (
                  <span className="collection-style-source__missing">No character layer</span>
                )}
                <strong>{asset.name}</strong>
                <small>{asset.eligible ? `${asset.prompts.archetype ?? "Unknown"} · ${asset.prompts.district ?? "Unknown"}` : "Ineligible source"}</small>
              </label>
            ))}
          </div>
        )}

        <button className="btn-primary" onClick={() => void startTraining()} disabled={!canStartTraining}>
          {action === "training" ? "⏳ Preparing training…" : "Train collection style LoRA"}
        </button>

        {latestTrainingJob && (
          <div className="collection-style-job">
            <span>
              Latest training: <strong>{statusLabel(latestTrainingJob.status)}</strong>
              {latestTrainingJob.sourceCount ? ` · ${latestTrainingJob.sourceCount} sources` : ""}
              {latestTrainingJob.queueStatus ? ` · ${latestTrainingJob.queueStatus}` : ""}
            </span>
            {latestTrainingJob.status === "training" && (
              <button className="btn-outline" onClick={() => void refreshTraining()} disabled={action !== null}>
                {action === "refresh-training" ? "⏳ Checking…" : "Check training status"}
              </button>
            )}
            {latestTrainingJob.error && <span className="admin-error">{latestTrainingJob.error}</span>}
          </div>
        )}
      </section>

      <section className="asset-gen-section">
        <div className="collection-style-panel__header">
          <div>
            <h2 className="asset-gen-section-title">2. Approval-gated 64-card batch</h2>
            <p className="asset-gen-toolbar-copy">
              Each card reuses static district backgrounds, rarity frames, approved board art, weapons, and placement presets.
              Only the character layer is generated and background-removed.
            </p>
          </div>
          <button className="btn-primary" onClick={() => void createBatch()} disabled={!profile?.loraUrl || action !== null}>
            {action === "create-batch" ? "⏳ Creating…" : "Create 64-card batch"}
          </button>
        </div>

        {activeBatch ? (
          <div className="collection-style-batch">
            <div className="collection-style-batch__summary">
              <strong>{activeBatch.phase === "approval" ? "Approval batch" : "Production batch"}</strong>
              <span>
                {activeBatch.progress?.completed ?? 0} / {activeBatch.progress?.total ?? activeBatch.totalCards} persisted
                {activeBatch.progress?.failed ? ` · ${activeBatch.progress.failed} failed` : ""}
              </span>
            </div>

            {activeBatch.phase === "approval" ? (
              <div className="collection-style-batch__actions">
                {completedApproval < approvalCount ? (
                  <button className="btn-primary" onClick={() => void generateNext()} disabled={action !== null}>
                    {action === "generate" ? "⏳ Generating…" : `Generate next approval card (${completedApproval}/${approvalCount})`}
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => void approveBatch()} disabled={action !== null}>
                    {action === "approve" ? "⏳ Releasing…" : "Approve visuals & cost; release remaining 60"}
                  </button>
                )}
              </div>
            ) : (
              <div className="collection-style-batch__actions">
                <button className="btn-primary" onClick={() => void generateNext()} disabled={action !== null}>
                  {action === "generate" ? "⏳ Generating…" : "Generate next collection card"}
                </button>
              </div>
            )}

            {failedItems.length > 0 && (
              <button className="btn-outline" onClick={() => void generateNext(true)} disabled={action !== null}>
                {action === "retry" ? "⏳ Retrying…" : `Retry failed card (${failedItems.length})`}
              </button>
            )}

            {completedItems.length > 0 && (
              <div className="collection-style-result-grid">
                {completedItems.map((item) => (
                  <article key={item.id} className="collection-style-result">
                    {item.card?.characterImageUrl && <img src={item.card.characterImageUrl} alt="" />}
                    <strong>{item.name}</strong>
                    <small>{item.card?.prompts.district ?? "Collection"} · persisted to Boss Assets</small>
                  </article>
                ))}
              </div>
            )}
            {failedItems.length > 0 && (
              <ul className="collection-style-failures">
                {failedItems.map((item) => <li key={item.id}>{item.name}: {item.lastError || "Generation failed."}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <p className="adlp-empty">Complete training, then create a 64-card batch. The first four cards remain blocked for review.</p>
        )}
      </section>
    </div>
  );
}
