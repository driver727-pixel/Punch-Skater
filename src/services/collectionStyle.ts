import { auth } from "../lib/firebase";
import { resolveAdminActionUrl } from "../lib/apiUrls";
import type { CardPayload } from "../lib/types";

export interface CollectionStyleSourceAsset {
  id: string;
  name: string;
  characterImageUrl: string | null;
  createdAt: string | null;
  prompts: Record<string, unknown>;
  eligible: boolean;
}

export interface CollectionStyleProfile {
  id: string;
  status?: "ready";
  version?: string;
  loraUrl?: string;
  loraScale?: number;
  triggerToken?: string;
  modelUrl?: string;
  sourceCount?: number;
  updatedAt?: string;
  activatedAt?: string;
  training?: {
    jobId?: string;
    status?: "preparing" | "training" | "failed";
  } | null;
}

export interface CollectionStyleTrainingJob {
  id: string;
  status: "preparing" | "training" | "completed" | "failed";
  triggerToken?: string;
  sourceCount?: number;
  submittedAt?: string;
  completedAt?: string;
  error?: string;
  queueStatus?: string;
}

export interface CollectionStyleBatchProgress {
  total: number;
  completed: number;
  pending: number;
  generating: number;
  failed: number;
  approvalCompleted: number;
  approvalCount: number;
}

export interface CollectionStyleBatch {
  id: string;
  status: "approval" | "production";
  phase: "approval" | "production";
  totalCards: number;
  approvalCount: number;
  createdAt?: string;
  approvedAt?: string;
  progress?: CollectionStyleBatchProgress;
}

export interface CollectionStyleBatchItem {
  id: string;
  index: number;
  name: string;
  status: "pending" | "generating" | "completed" | "failed";
  attempts?: number;
  lastError?: string | null;
  card?: CardPayload;
}

interface CollectionStyleOverview {
  profile: CollectionStyleProfile | null;
  trainingJobs: CollectionStyleTrainingJob[];
  batches: CollectionStyleBatch[];
}

async function getHeaders(): Promise<HeadersInit> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in with an admin account to use collection-style generation.");
  return {
    "Content-Type": "application/json",
    Authorization: `******
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveAdminActionUrl(path), {
    ...init,
    headers: {
      ...(await getHeaders()),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Collection-style request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function getCollectionStyleOverview(): Promise<CollectionStyleOverview> {
  return request<CollectionStyleOverview>("/api/admin/collection-style");
}

export function getCollectionStyleSourceAssets(): Promise<{ assets: CollectionStyleSourceAsset[] }> {
  return request<{ assets: CollectionStyleSourceAsset[] }>("/api/admin/collection-style/source-assets");
}

export function startCollectionStyleTraining(input: {
  sourceCardIds: string[];
  triggerToken: string;
  ownershipConfirmed: boolean;
  characterLayersConfirmed: boolean;
}): Promise<{ jobId: string; status: string }> {
  return request<{ jobId: string; status: string }>("/api/admin/collection-style/training", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCollectionStyleTrainingJob(jobId: string): Promise<{
  job: CollectionStyleTrainingJob;
  profile?: CollectionStyleProfile;
}> {
  return request(`/api/admin/collection-style/training/${encodeURIComponent(jobId)}`);
}

export function createCollectionStyleBatch(): Promise<{ batch: CollectionStyleBatch }> {
  return request<{ batch: CollectionStyleBatch }>("/api/admin/collection-style/batches", {
    method: "POST",
    body: JSON.stringify({ totalCards: 64 }),
  });
}

export function getCollectionStyleBatch(batchId: string): Promise<{
  batch: CollectionStyleBatch;
  items: CollectionStyleBatchItem[];
}> {
  return request(`/api/admin/collection-style/batches/${encodeURIComponent(batchId)}`);
}

export function approveCollectionStyleBatch(batchId: string): Promise<{ batch: CollectionStyleBatch }> {
  return request(`/api/admin/collection-style/batches/${encodeURIComponent(batchId)}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function generateNextCollectionStyleCard(
  batchId: string,
  retryFailed = false,
): Promise<{ status: string; item?: CollectionStyleBatchItem; message?: string }> {
  return request(`/api/admin/collection-style/batches/${encodeURIComponent(batchId)}/generate-next`, {
    method: "POST",
    body: JSON.stringify({ retryFailed }),
  });
}
