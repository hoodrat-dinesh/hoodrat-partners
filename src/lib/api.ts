import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthorizationError } from "@/lib/auth";
import { ConfigurationError } from "@/lib/env";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON", 400);
  }
  return schema.parse(body);
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) {
    throw new ApiError("Origin header is required", 403);
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError("Invalid Origin header", 403);
  }

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    throw new ApiError("Cross-origin mutation rejected", 403);
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: error.issues },
      { status: 422 },
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ConfigurationError) {
    return NextResponse.json(
      { error: "Service is not configured", missing: error.missing },
      { status: 503 },
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status },
    );
  }
  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function throwIfDatabaseError(
  error: { message: string; code?: string } | null,
  fallback = "Database operation failed",
): void {
  if (!error) return;
  const conflict = error.code === "23505";
  throw new ApiError(conflict ? "Resource already exists" : fallback, conflict ? 409 : 400);
}
