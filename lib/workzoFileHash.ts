export async function sha256Hex(input: Blob | ArrayBuffer | Uint8Array | string): Promise<string> {
  let bytes: Uint8Array;

  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Blob) {
    bytes = new Uint8Array(await input.arrayBuffer());
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }

  // Copy into a fresh, plain ArrayBuffer so the argument is a BufferSource that
  // TS 5.7+ accepts. It rejects Uint8Array<ArrayBufferLike> here because the
  // backing buffer could in theory be a SharedArrayBuffer. Copying via set()
  // respects the view's byteOffset/byteLength, so subarray inputs hash correctly.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type CvProcessingStatus = "queued" | "processing" | "completed" | "failed" | "duplicate";

export type CvProcessingRecord = {
  jobId: string;
  fileHash: string;
  fileName: string;
  status: CvProcessingStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

const KEY = "workzo_cv_processing_jobs_v1";

function safeSession(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}

export function readCvJob(jobId: string): CvProcessingRecord | null {
  const ss = safeSession();
  if (!ss || !jobId) return null;
  try {
    const all = JSON.parse(ss.getItem(KEY) || "{}") as Record<string, CvProcessingRecord>;
    return all[jobId] || null;
  } catch { return null; }
}

export function upsertCvJob(record: CvProcessingRecord): void {
  const ss = safeSession();
  if (!ss) return;
  try {
    const all = JSON.parse(ss.getItem(KEY) || "{}") as Record<string, CvProcessingRecord>;
    all[record.jobId] = record;
    ss.setItem(KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function findDuplicateCvJob(fileHash: string): CvProcessingRecord | null {
  const ss = safeSession();
  if (!ss || !fileHash) return null;
  try {
    const all = JSON.parse(ss.getItem(KEY) || "{}") as Record<string, CvProcessingRecord>;
    return Object.values(all).find((j) => j.fileHash === fileHash && (j.status === "processing" || j.status === "completed")) || null;
  } catch { return null; }
}
