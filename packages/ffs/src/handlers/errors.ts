import type express from "express";
import type { Response as UndiciResponse } from "undici";
import { SsrfError } from "../url";

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

export class FetchError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    statusText: string,
    options?: ErrorOptions,
  ) {
    super(`Failed to fetch ${url}: ${status} ${statusText}`, options);
    this.name = "FetchError";
  }
}

/**
 * A source whose response started, but whose body failed partway (its
 * connection dropped, say). The read error is its `cause`.
 */
export class FetchBodyError extends FetchError {
  constructor(url: string, status: number, cause: unknown) {
    super(url, status, "", { cause });
    const reason = cause instanceof Error ? cause.message : String(cause);
    this.message = `Failed to fetch ${url}: response body failed: ${reason}`;
  }
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

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** The code to report an error with, e.g. in an SSE `error` event. */
export function toErrorCode(error: unknown): ErrorCode {
  if (error instanceof BackendError) return error.code;
  if (error instanceof FetchError || error instanceof SsrfError)
    return ErrorCode.FETCH_FAILED;
  return ErrorCode.INTERNAL_ERROR;
}
