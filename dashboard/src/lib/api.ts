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
  {
    accent: string;
    label: string;
    short: string;
    logo: string;
    gradientFrom: string;
    gradientTo: string;
    mission: string;
    blurb: string;
  }
> = {
  pearl_mbpp: {
    accent: "#f97316",
    label: "Pearl eAduan (MBPP)",
    short: "Pearl",
    logo: "/agencies/pearl_mbpp.png",
    gradientFrom: "#fff7ed",
    gradientTo: "#ffffff",
    mission: "Kebersihan dan kemudahan awam bandar.",
    blurb:
      "Majlis Bandaraya Pulau Pinang — kebersihan, longkang lokal, kemudahan awam",
  },
  aspire_mbsp: {
    accent: "#1e3a8a",
    label: "Aspire eAduan (MBSP)",
    short: "Aspire",
    logo: "/agencies/aspire_mbsp.png",
    gradientFrom: "#eff6ff",
    gradientTo: "#ffffff",
    mission: "Aduan PBT Seberang Perai.",
    blurb: "Majlis Bandaraya Seberang Perai — aduan PBT di Seberang",
  },
  myjalan: {
    accent: "#c2410c",
    label: "MyJalan (JKR / KKR)",
    short: "MyJalan",
    logo: "/agencies/myjalan.png",
    gradientFrom: "#fff7ed",
    gradientTo: "#ffffff",
    mission: "Jalan persekutuan dan lampu isyarat.",
    blurb: "JKR / KKR — jalan persekutuan, lampu isyarat, infrastruktur jalan",
  },
  pbapp: {
    accent: "#0e7490",
    label: "PBAPP (Bekalan Air)",
    short: "PBAPP",
    logo: "/agencies/pbapp.png",
    gradientFrom: "#ecfeff",
    gradientTo: "#ffffff",
    mission: "Bekalan air dan paip awam.",
    blurb: "Bekalan air Pulau Pinang — paip bocor, gangguan air",
  },
  epintas: {
    accent: "#a16207",
    label: "ePINTAS (PSUK)",
    short: "ePINTAS",
    logo: "/agencies/epintas.png",
    gradientFrom: "#fffbeb",
    gradientTo: "#ffffff",
    mission: "Triaj aduan luar bidang dan banjir.",
    blurb: "PSUK triage — banjir, luar bidang, kes tidak pasti",
  },
};

export const STATUS_BM: Record<string, string> = {
  received: "Diterima",
  acknowledged: "Diakui",
  in_progress: "Dalam tindakan",
  resolved: "Selesai",
  rejected: "Ditolak",
};
