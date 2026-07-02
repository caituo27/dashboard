import { message } from "antd";
import { isGlobalAuthError, localizeApiMessage } from "../utils/http";

export function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${localizeApiMessage(error.message, fallback)}` : fallback);
}
