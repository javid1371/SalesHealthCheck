import { ASSESSMENT_TOKEN_HEADER } from "@/lib/assessment-token";
import type { ApiErrorBody } from "@/types/api";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type ApiClientOptions = {
  /** Assessment result token → sent as `X-Assessment-Token`. */
  token?: string | null;
};

function buildHeaders(
  options?: ApiClientOptions,
  jsonBody?: boolean,
): HeadersInit {
  const headers: Record<string, string> = {};
  if (jsonBody) {
    headers["Content-Type"] = "application/json";
  }
  if (options?.token) {
    headers[ASSESSMENT_TOKEN_HEADER] = options.token;
  }
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T | ApiErrorBody;

  if (!res.ok) {
    const err = body as ApiErrorBody;
    throw new ApiClientError(
      err.error.code,
      err.error.message,
      res.status,
      err.error.details,
    );
  }

  return body as T;
}

export async function apiGet<T>(
  url: string,
  options?: ApiClientOptions,
): Promise<T> {
  const res = await fetch(url, {
    headers: buildHeaders(options),
  });
  return parseResponse<T>(res);
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  options?: ApiClientOptions,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(options, true),
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(
  url: string,
  data: unknown,
  options?: ApiClientOptions,
): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: buildHeaders(options, true),
    body: JSON.stringify(data),
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(
  url: string,
  options?: ApiClientOptions,
): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: buildHeaders(options),
  });
  return parseResponse<T>(res);
}
