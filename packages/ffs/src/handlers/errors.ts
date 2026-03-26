import type express from "express";
import type { Response as UndiciResponse } from "undici";

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_EFFIE: "INVALID_EFFIE",
  NOT_FOUND: "NOT_FOUND",
  BACKEND_FAILED: "BACKEND_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FETCH_FAILED: "FETCH_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ApiError = {
  error: string;
  code: ErrorCode;
  issues?: Array<{ path: string; message: string }>;
};

export function sendError(
  res: express.Response,
  status: number,
  code: ErrorCode,
  message: string,
  issues?: Array<{ path: string; message: string }>,
): void {
  if (res.headersSent) return;
  const body: ApiError = { error: message, code };
  if (issues) body.issues = issues;
  res.status(status).json(body);
}

export class BackendError extends Error {
  override readonly name = "BackendError";

  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Parse a non-ok backend response into a BackendError.
 * Tries to read the JSON body for structured error info; falls back to status code.
 */
export async function backendError(
  response: UndiciResponse,
): Promise<BackendError> {
  let code: ErrorCode = ErrorCode.BACKEND_FAILED;
  let message = `Backend render failed: ${response.status}`;
  try {
    const body = (await response.json()) as Partial<ApiError>;
    if (
      body.code &&
      (Object.values(ErrorCode) as string[]).includes(body.code)
    ) {
      code = body.code as ErrorCode;
    }
    if (body.error) {
      message = body.error;
    }
  } catch {
    // Response wasn't JSON — use defaults
  }
  return new BackendError(response.status, code, message);
}
