import { message } from "antd";
import { isGlobalAuthError } from "../utils/http";

export function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}
