import { getToken } from "@/lib/api";

const TOKENS_KEY = "urp_agency_tokens";
const LEGACY_KEY = "urp_agency_token";

export type JwtClaims = {
  sub?: string;
  role?: string;
  agencyId?: string | null;
  uid?: string;
  exp?: number;
};

function readTokenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    const claims = decodeJwtPayload(legacy);
    if (claims?.agencyId) {
      const map = { [claims.agencyId]: legacy };
      localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
      localStorage.removeItem(LEGACY_KEY);
      return map;
    }
  }
  return {};
}

function writeTokenMap(map: Record<string, string>) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
}

export function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

const ADMIN_ROLES = new Set(["super_admin", "admin"]);
const AGENCY_ROLES = new Set(["agency_admin", "agency_operator"]);

export function isAdminClaims(claims: JwtClaims | null) {
  return claims?.role ? ADMIN_ROLES.has(claims.role) : false;
}

export function tokenValidForAgency(token: string, agencyId: string) {
  const claims = decodeJwtPayload(token);
  if (!claims?.sub) return false;
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return false;
  if (isAdminClaims(claims)) return true;
  if (AGENCY_ROLES.has(claims.role || "")) {
    return claims.agencyId === agencyId;
  }
  return false;
}

export function getAgencyToken(agencyId?: string) {
  if (!agencyId) {
    const map = readTokenMap();
    const first = Object.values(map)[0];
    return first || null;
  }
  const map = readTokenMap();
  const token = map[agencyId];
  if (token && tokenValidForAgency(token, agencyId)) return token;

  const admin = getToken();
  if (admin && tokenValidForAgency(admin, agencyId)) return admin;

  return null;
}

export function hasAgencySession(agencyId: string) {
  return Boolean(getAgencyToken(agencyId));
}

export function setAgencyToken(agencyId: string, token: string) {
  const map = readTokenMap();
  map[agencyId] = token;
  writeTokenMap(map);
}

export function clearAgencyToken(agencyId?: string) {
  if (!agencyId) {
    localStorage.removeItem(TOKENS_KEY);
    localStorage.removeItem(LEGACY_KEY);
    return;
  }
  const map = readTokenMap();
  delete map[agencyId];
  writeTokenMap(map);
}

export function getSessionClaims(agencyId: string): JwtClaims | null {
  const token = getAgencyToken(agencyId);
  return token ? decodeJwtPayload(token) : null;
}

export async function agencyApi<T>(
  agencyId: string,
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = getAgencyToken(agencyId);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && options.auth !== false) {
    clearAgencyToken(agencyId);
    if (!window.location.pathname.includes("/login")) {
      window.location.href = `/portals/${agencyId}/login`;
    }
  }
  if (res.status === 403 && options.auth !== false) {
    clearAgencyToken(agencyId);
    const msg = "Sila log masuk untuk agensi ini";
    sessionStorage.setItem("agency_login_toast", msg);
    window.location.href = `/portals/${agencyId}/login`;
    throw new Error(msg);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}
