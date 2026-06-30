import type { ArtifactSnapshot } from "../apis/sprix";
import { downloadRemoteMyTaskArtifact } from "../services/sprixApi";
import { getArtifactTitle } from "./executionDetailView";

const JSON_MIME_TYPE = "application/json";

export class ArtifactDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactDownloadError";
  }
}

export async function saveTaskArtifact(executionId: string, artifact: ArtifactSnapshot, fileId: string): Promise<void> {
  const blob = await downloadRemoteMyTaskArtifact(executionId, fileId, artifact.downloadUrl);
  const apiError = await readApiErrorMessage(blob);
  if (apiError) {
    throw new ArtifactDownloadError(apiError);
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = downloadFilename(artifact);
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

async function readApiErrorMessage(blob: Blob): Promise<string | undefined> {
  if (!blob.type.includes(JSON_MIME_TYPE)) return undefined;

  const text = await blob.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }

  if (!isRecord(parsed) || parsed.success !== false) return undefined;
  return typeof parsed.message === "string" ? parsed.message : "文件下载失败";
}

function downloadFilename(artifact: ArtifactSnapshot): string {
  const title = getArtifactTitle(artifact).trim() || "artifact";
  const parts = title.split(/[\\/]/).filter(Boolean);
  const filename = parts[parts.length - 1];
  return filename ?? "artifact";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
