import type express from "express";

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
