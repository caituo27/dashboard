import { useState } from "react";
import { message } from "antd";
import { Download } from "lucide-react";
import type { ArtifactSnapshot } from "../apis/sprix";
import { saveTaskArtifact } from "./artifactDownload";

type ArtifactDownloadButtonProps = {
  readonly executionId: string;
  readonly artifact: ArtifactSnapshot;
  readonly fileId: string;
};

export function ArtifactDownloadButton({ executionId, artifact, fileId }: ArtifactDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await saveTaskArtifact(executionId, artifact, fileId);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
        return;
      }
      message.error("文件下载失败");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button type="button" className="sprix-icon-action" disabled={downloading} aria-label="下载" title="下载" onClick={() => void handleDownload()}>
      <Download size={16} />
    </button>
  );
}
