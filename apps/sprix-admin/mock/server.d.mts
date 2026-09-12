import type { IncomingMessage, ServerResponse } from "node:http";
export function dashboardMockMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void): void;
