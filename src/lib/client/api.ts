export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** Wrapper fetch untuk komponen client: selalu mengembalikan envelope, tidak pernah melempar. */
export async function api<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign("/login");
    }
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return {
      success: false,
      error: { code: "NETWORK", message: "Koneksi bermasalah. Periksa jaringan lalu coba lagi." },
    };
  }
}
