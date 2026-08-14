import { useEffect, useState } from "react";

const executionProgressStages = [
  { actual: 0, display: 0 },
  { actual: 5, display: 5 },
  { actual: 20, display: 5 },
  { actual: 45, display: 5 },
  { actual: 70, display: 80 },
  { actual: 82, display: 85 },
  { actual: 90, display: 95 },
  { actual: 95, display: 98 },
  { actual: 100, display: 100 }
] as const;
const executionProgressStoragePrefix = "sprix-execution-display-progress:v2:";

export function parseExecutionProgress(progress?: string) {
  const value = Number.parseFloat(progress ?? "");
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.floor(value))) : undefined;
}

function getExecutionProgressCeiling(progress: number) {
  const nextStage = executionProgressStages.find((stage) => stage.actual > progress);
  return nextStage === undefined ? 100 : nextStage.display - 1;
}

function getExecutionDisplayProgress(progress: number, isRunning: boolean) {
  if (!isRunning && progress === 90) return 90;
  const currentStage = [...executionProgressStages].reverse().find((stage) => stage.actual <= progress);
  return currentStage?.display ?? progress;
}

function readStoredExecutionProgress(executionId?: string) {
  if (!executionId) return undefined;
  return parseExecutionProgress(sessionStorage.getItem(`${executionProgressStoragePrefix}${executionId}`) ?? undefined);
}

function storeExecutionProgress(executionId: string | undefined, progress: number | undefined) {
  if (!executionId || progress === undefined) return;
  const storageKey = `${executionProgressStoragePrefix}${executionId}`;
  if (progress >= 100) {
    sessionStorage.removeItem(storageKey);
    return;
  }
  sessionStorage.setItem(storageKey, String(progress));
}

export function useExecutionDisplayProgress({
  executionId,
  actualProgress,
  isRunning
}: {
  executionId?: string;
  actualProgress?: number;
  isRunning: boolean;
}) {
  const [displayProgress, setDisplayProgress] = useState<number>();
  const progressCeiling = actualProgress === undefined ? undefined : getExecutionProgressCeiling(actualProgress);

  useEffect(() => {
    const storedProgress = readStoredExecutionProgress(executionId);
    const mappedProgress = actualProgress === undefined ? undefined : getExecutionDisplayProgress(actualProgress, isRunning);
    const nextProgress =
      actualProgress === undefined
        ? storedProgress
        : storedProgress === undefined
          ? mappedProgress
          : Math.max(mappedProgress ?? actualProgress, storedProgress);
    setDisplayProgress(nextProgress);
    storeExecutionProgress(executionId, nextProgress);
  }, [executionId, actualProgress, isRunning]);

  useEffect(() => {
    if (!isRunning || displayProgress === undefined || progressCeiling === undefined || displayProgress >= progressCeiling) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDisplayProgress((current) => {
        const nextProgress = Math.min((current ?? displayProgress) + 1, progressCeiling);
        storeExecutionProgress(executionId, nextProgress);
        return nextProgress;
      });
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [executionId, displayProgress, isRunning, progressCeiling]);

  return displayProgress;
}
