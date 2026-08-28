const AGENCY_TOKEN_KEY = "urp_agency_token";

export function getAgencyToken() {
  return localStorage.getItem(AGENCY_TOKEN_KEY);
}

export function setAgencyToken(token: string) {
  localStorage.setItem(AGENCY_TOKEN_KEY, token);
}

export function clearAgencyToken() {
  localStorage.removeItem(AGENCY_TOKEN_KEY);
}

export type AgencyLayout = "dashboard" | "app";

const LAYOUT_KEY = "urp_agency_layout";

export function getAgencyLayout(): AgencyLayout {
  const v = localStorage.getItem(LAYOUT_KEY);
  if (v === "dashboard" || v === "app") return v;
  return window.innerWidth >= 900 ? "dashboard" : "app";
}

export function setAgencyLayout(layout: AgencyLayout) {
  localStorage.setItem(LAYOUT_KEY, layout);
}

export async function agencyApi<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = getAgencyToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && options.auth !== false) {
    clearAgencyToken();
    const agencyMatch = window.location.pathname.match(
      /\/portals\/([^/]+)/
    );
    const agencyId = agencyMatch?.[1] || "";
    if (!window.location.pathname.includes("/login")) {
      window.location.href = agencyId
        ? `/portals/${agencyId}/login`
        : "/admin/login";
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}
