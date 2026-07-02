import { useState } from "react";
import { message } from "antd";
import { Download } from "lucide-react";
import type { ArtifactSnapshot } from "../apis/sprix";
import { SecondaryButton } from "../components/Primitives";
import { localizeApiMessage } from "../utils/http";
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
        message.error(localizeApiMessage(error.message, "文件下载失败"));
        return;
      }
      message.error("文件下载失败");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <SecondaryButton loading={downloading} disabled={downloading} icon={<Download size={15} />} onClick={() => void handleDownload()}>
      下载
    </SecondaryButton>
  );
}
