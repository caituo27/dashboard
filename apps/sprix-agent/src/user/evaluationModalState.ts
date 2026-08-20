const evaluationModalDismissedStorageKey = "sprix-agent-evaluation-modal-dismissed";

function getEvaluationModalDismissedKey(accountScope: string, evaluationId: string) {
  return `${evaluationModalDismissedStorageKey}:${accountScope}:${evaluationId}`;
}

export function isEvaluationModalDismissed(accountScope: string, evaluationId: string) {
  if (!accountScope || !evaluationId) return false;
  try {
    return window.sessionStorage.getItem(getEvaluationModalDismissedKey(accountScope, evaluationId)) === "true";
  } catch {
    return false;
  }
}

export function setEvaluationModalDismissed(accountScope: string, evaluationId: string, dismissed: boolean) {
  if (!accountScope || !evaluationId) return;
  try {
    const storageKey = getEvaluationModalDismissedKey(accountScope, evaluationId);
    if (dismissed) {
      window.sessionStorage.setItem(storageKey, "true");
    } else {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // sessionStorage may be unavailable in privacy-restricted browser contexts.
  }
}
