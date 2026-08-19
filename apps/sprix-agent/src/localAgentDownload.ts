export const LOCAL_AGENT_DOWNLOAD_URL =
  "https://cnb.cool/yztx_qxun/LocalCLIAgentRelease/-/git/raw/main/LocalCLIAgent-latest.dmg";

export const LOCAL_AGENT_HEALTH_URL =
  "http://127.0.0.1:38765/health";

export async function checkLocalAgentHealth() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(LOCAL_AGENT_HEALTH_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`LocalAgent health request failed: ${response.status}`);
    return true;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const LOCAL_AGENT_CLI_MODE_URL = "https://mvfpzkgte05.feishu.cn/wiki/FSYnwwdXritmVNkKoRkcGyOFnTc?from=from_copylink";
