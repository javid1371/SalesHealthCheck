import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const USER_SESSION_COOKIE = "shc_user_session";
export const ADMIN_SESSION_COOKIE = "shc_admin_session";
export const SALES_EXPERT_SESSION_COOKIE = "shc_sales_expert_session";

const DEFAULT_USER_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_ADMIN_TTL_SECONDS = 60 * 60 * 24;
const DEFAULT_SALES_EXPERT_TTL_SECONDS = 60 * 60 * 24 * 7;

export type UserSession = {
  userId: string;
};

export type AdminSession = {
  role: "admin";
  staffUserId?: string;
  name?: string;
};

export type SalesExpertSession = {
  role: "sales_expert";
  staffUserId?: string;
  name?: string;
};

type UserSessionPayload = {
  userId: string;
  exp: number;
};

type AdminSessionPayload = {
  role: "admin";
  exp: number;
  staffUserId?: string;
  name?: string;
};

type SalesExpertSessionPayload = {
  role: "sales_expert";
  exp: number;
  staffUserId?: string;
  name?: string;
};

type SessionScope = "user" | "admin" | "sales_expert" | "all";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function signPayload(
  payload:
    | UserSessionPayload
    | AdminSessionPayload
    | SalesExpertSessionPayload,
): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", env.authSessionSecret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifySignedPayload<T extends { exp: number }>(
  value: string | undefined,
): T | null {
  if (!value) {
    return null;
  }

  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const payloadB64 = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expectedSignature = createHmac("sha256", env.authSessionSecret)
    .update(payloadB64)
    .digest("base64url");

  if (!timingSafeCompare(signature, expectedSignature)) {
    return null;
  }

  let payload: T;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds()) {
    return null;
  }

  return payload;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function encodeUserSession(userId: string, ttlSeconds: number): string {
  const payload: UserSessionPayload = {
    userId,
    exp: nowSeconds() + ttlSeconds,
  };
  return signPayload(payload);
}

function encodeAdminSession(
  ttlSeconds: number,
  staff?: { staffUserId?: string; name?: string },
): string {
  const payload: AdminSessionPayload = {
    role: "admin",
    exp: nowSeconds() + ttlSeconds,
    ...(staff?.staffUserId ? { staffUserId: staff.staffUserId } : {}),
    ...(staff?.name ? { name: staff.name } : {}),
  };
  return signPayload(payload);
}

function encodeSalesExpertSession(
  ttlSeconds: number,
  staff?: { staffUserId?: string; name?: string },
): string {
  const payload: SalesExpertSessionPayload = {
    role: "sales_expert",
    exp: nowSeconds() + ttlSeconds,
    ...(staff?.staffUserId ? { staffUserId: staff.staffUserId } : {}),
    ...(staff?.name ? { name: staff.name } : {}),
  };
  return signPayload(payload);
}

/** Parse a signed user session cookie value (e.g. from `NextRequest.cookies`). */
export function parseUserSessionCookie(
  value: string | undefined,
): UserSession | null {
  const payload = verifySignedPayload<UserSessionPayload>(value);
  if (
    !payload ||
    typeof payload.userId !== "string" ||
    payload.userId.length === 0
  ) {
    return null;
  }
  return { userId: payload.userId };
}

/** Parse a signed admin session cookie value (e.g. from `NextRequest.cookies`). */
export function parseAdminSessionCookie(
  value: string | undefined,
): AdminSession | null {
  const payload = verifySignedPayload<AdminSessionPayload>(value);
  if (!payload || payload.role !== "admin") {
    return null;
  }
  return {
    role: "admin",
    ...(typeof payload.staffUserId === "string" && payload.staffUserId.length > 0
      ? { staffUserId: payload.staffUserId }
      : {}),
    ...(typeof payload.name === "string" && payload.name.length > 0
      ? { name: payload.name }
      : {}),
  };
}

/** Parse a signed sales expert session cookie value. */
export function parseSalesExpertSessionCookie(
  value: string | undefined,
): SalesExpertSession | null {
  const payload = verifySignedPayload<SalesExpertSessionPayload>(value);
  if (!payload || payload.role !== "sales_expert") {
    return null;
  }
  return {
    role: "sales_expert",
    ...(typeof payload.staffUserId === "string" && payload.staffUserId.length > 0
      ? { staffUserId: payload.staffUserId }
      : {}),
    ...(typeof payload.name === "string" && payload.name.length > 0
      ? { name: payload.name }
      : {}),
  };
}

export async function createUserSession(
  userId: string,
  options?: { ttlSeconds?: number },
): Promise<UserSession> {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_USER_TTL_SECONDS;
  const value = encodeUserSession(userId, ttlSeconds);
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, value, cookieOptions(ttlSeconds));
  return { userId };
}

export async function readUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  return parseUserSessionCookie(cookieStore.get(USER_SESSION_COOKIE)?.value);
}

export async function createAdminSession(
  options?: {
    ttlSeconds?: number;
    staffUserId?: string;
    name?: string;
  },
): Promise<AdminSession> {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_ADMIN_TTL_SECONDS;
  const value = encodeAdminSession(ttlSeconds, {
    staffUserId: options?.staffUserId,
    name: options?.name,
  });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, value, cookieOptions(ttlSeconds));
  return {
    role: "admin",
    ...(options?.staffUserId ? { staffUserId: options.staffUserId } : {}),
    ...(options?.name ? { name: options.name } : {}),
  };
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return parseAdminSessionCookie(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

export async function createSalesExpertSession(
  options?: {
    ttlSeconds?: number;
    staffUserId?: string;
    name?: string;
  },
): Promise<SalesExpertSession> {
  const ttlSeconds =
    options?.ttlSeconds ?? DEFAULT_SALES_EXPERT_TTL_SECONDS;
  const value = encodeSalesExpertSession(ttlSeconds, {
    staffUserId: options?.staffUserId,
    name: options?.name,
  });
  const cookieStore = await cookies();
  cookieStore.set(
    SALES_EXPERT_SESSION_COOKIE,
    value,
    cookieOptions(ttlSeconds),
  );
  return {
    role: "sales_expert",
    ...(options?.staffUserId ? { staffUserId: options.staffUserId } : {}),
    ...(options?.name ? { name: options.name } : {}),
  };
}

export async function readSalesExpertSession(): Promise<SalesExpertSession | null> {
  const cookieStore = await cookies();
  return parseSalesExpertSessionCookie(
    cookieStore.get(SALES_EXPERT_SESSION_COOKIE)?.value,
  );
}

export async function clearSession(scope: SessionScope = "all"): Promise<void> {
  const cookieStore = await cookies();
  if (scope === "user" || scope === "all") {
    cookieStore.delete(USER_SESSION_COOKIE);
  }
  if (scope === "admin" || scope === "all") {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
  }
  if (scope === "sales_expert" || scope === "all") {
    cookieStore.delete(SALES_EXPERT_SESSION_COOKIE);
  }
}

type RequestCookieReader = {
  cookies: {
    get: (name: string) => { value: string } | undefined;
  };
};

/** Read signed user/admin session cookies from an incoming request. */
export function readSessionsFromRequest(request: RequestCookieReader): {
  userSession: UserSession | null;
  adminSession: AdminSession | null;
  salesExpertSession: SalesExpertSession | null;
} {
  return {
    userSession: parseUserSessionCookie(
      request.cookies.get(USER_SESSION_COOKIE)?.value,
    ),
    adminSession: parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    ),
    salesExpertSession: parseSalesExpertSessionCookie(
      request.cookies.get(SALES_EXPERT_SESSION_COOKIE)?.value,
    ),
  };
}
