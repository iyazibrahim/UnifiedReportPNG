const TOKEN_KEY = "urp_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && options.auth !== false) {
    clearToken();
    if (!window.location.pathname.includes("/admin/login")) {
      window.location.href = "/admin/login";
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

export const AGENCY_THEME: Record<
  string,
  { accent: string; label: string; short: string }
> = {
  pearl_mbpp: {
    accent: "#1c4b3a",
    label: "Pearl eAduan (MBPP)",
    short: "Pearl",
  },
  aspire_mbsp: {
    accent: "#1e3a8a",
    label: "Aspire eAduan (MBSP)",
    short: "Aspire",
  },
  myjalan: {
    accent: "#c2410c",
    label: "MyJalan (JKR / KKR)",
    short: "MyJalan",
  },
  pbapp: {
    accent: "#0e7490",
    label: "PBAPP (Bekalan Air)",
    short: "PBAPP",
  },
  epintas: {
    accent: "#a16207",
    label: "ePINTAS (PSUK)",
    short: "ePINTAS",
  },
};

export const STATUS_BM: Record<string, string> = {
  received: "Diterima",
  in_progress: "Dalam tindakan",
  resolved: "Selesai",
  rejected: "Ditolak",
};
